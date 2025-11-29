from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from api.models import Device, DeviceSensorMap, Sensor, Region, Depot, Transformer, DeviceUplink
from api.models import SensorReading
import os
import ssl
import json
import re
import base64

try:
    import websocket
except ImportError:
    websocket = None
try:
    import paho.mqtt.client as mqtt
except Exception:
    mqtt = None


class Command(BaseCommand):
    help = "Connect to LORIOT WebSocket and ingest uplinks"

    def add_arguments(self, parser):
        parser.add_argument('--url', type=str, default=os.getenv('LORIOT_WS_URL', ''))
        parser.add_argument('--insecure', action='store_true')
        parser.add_argument('--run-seconds', type=int, default=0)

    def handle(self, *args, **options):
        if websocket is None:
            self.stderr.write(self.style.ERROR('websocket-client not installed. Install with `pip install websocket-client`'))
            return

        url = options.get('url') or ''
        if not url:
            self.stderr.write(self.style.ERROR('Missing --url or LORIOT_WS_URL'))
            return

        insecure = bool(options.get('insecure'))

        def to_bytes(s):
            if s is None:
                return None
            if isinstance(s, (bytes, bytearray)):
                return bytes(s)
            if not isinstance(s, str):
                return None
            hs = s.strip()
            if re.fullmatch(r'[0-9A-Fa-f\s]+', hs):
                hs = hs.replace(' ', '')
                try:
                    return bytes.fromhex(hs)
                except Exception:
                    return None
            try:
                return base64.b64decode(hs, validate=False)
            except Exception:
                return None

        def decode_lpp(buf):
            if not buf:
                return {'records': [], 'primary_value': None}
            i = 0
            out = []
            while i + 2 <= len(buf):
                ch = buf[i]; t = buf[i+1]; i += 2
                if t in (0x02,0x03,0x67):
                    if i + 2 > len(buf): break
                    b0,b1 = buf[i],buf[i+1]; i += 2
                    be = ((b0<<8)|b1); be = be - 0x10000 if be>=0x8000 else be
                    le = ((b1<<8)|b0); le = le - 0x10000 if le>=0x8000 else le
                    if t in (0x02,0x03):
                        out.append({'channel':ch,'type':t,'value_be':be/100.0,'value_le':le/100.0,'name':'analog'})
                    elif t==0x67:
                        out.append({'channel':ch,'type':t,'value_be':be/10.0,'value_le':le/10.0,'name':'temperature'})
                elif t in (0x00,0x01,0x68):
                    if i + 1 > len(buf): break
                    b = buf[i]; i += 1
                    if t==0x68: out.append({'channel':ch,'type':t,'value':(b/2.0),'name':'humidity'})
                    elif t==0x00: out.append({'channel':ch,'type':t,'value':int(b),'name':'digital_in'})
                    elif t==0x01: out.append({'channel':ch,'type':t,'value':int(b),'name':'digital_out'})
                else:
                    break
            best = None
            for rec in out:
                if rec.get('name')=='temperature':
                    v = rec.get('value_le');
                    if v is not None and -50.0<=v<=85.0: best=v; break
                    v = rec.get('value_be');
                    if v is not None and -50.0<=v<=85.0: best=v; break
            if best is None:
                for rec in out:
                    if rec.get('name')=='humidity': best=rec.get('value'); break
            if best is None:
                for rec in out:
                    if rec.get('name') in ['analog','digital_in','digital_out']:
                        v = rec.get('value') or rec.get('value_le') or rec.get('value_be')
                        if v is not None: best=v; break
            return {'records':out,'primary_value':best}

        def decode_elsys(buf):
            i = 0; out = []; primary = None
            while i < len(buf):
                t = buf[i]; i += 1
                if t == 0x01 and i + 1 < len(buf):
                    v = (buf[i] << 8) | buf[i + 1]
                    if v >= 0x8000: v = v - 0x10000
                    temp = v / 10.0
                    out.append({'type': t, 'name': 'temperature', 'value': temp}); i += 2
                    if primary is None: primary = temp
                elif t == 0x02 and i < len(buf):
                    rh = buf[i]; out.append({'type': t, 'name': 'humidity', 'value': rh}); i += 1
                    if primary is None: primary = rh
                elif t == 0x0A and i < len(buf):
                    mv = buf[i]; out.append({'type': t, 'name': 'motion', 'value': mv}); i += 1
                    if primary is None: primary = mv
                else:
                    break
            return {'records': out, 'primary_value': primary}

        def decode_milesight(buf):
            return decode_lpp(buf)

        def decode_vendor(buf, hint=None):
            if not buf:
                return {'codec': None, 'records': [], 'primary_value': None}
            if hint in ('cayenne','lpp'):
                d = decode_lpp(buf); return {'codec':'cayenne','records':d['records'],'primary_value':d['primary_value']}
            if hint == 'elsys':
                d = decode_elsys(buf); return {'codec':'elsys','records':d['records'],'primary_value':d['primary_value']}
            if hint == 'milesight':
                d = decode_milesight(buf); return {'codec':'milesight','records':d['records'],'primary_value':d['primary_value']}
            d = decode_lpp(buf)
            if d.get('records'):
                return {'codec':'cayenne','records':d['records'],'primary_value':d['primary_value']}
            d = decode_elsys(buf)
            if d.get('records'):
                return {'codec':'elsys','records':d['records'],'primary_value':d['primary_value']}
            return {'codec': None, 'records': [], 'primary_value': None}

        def ensure_transformer(device):
            if device.transformer is None:
                region, _ = Region.objects.get_or_create(name='Unassigned')
                depot, _ = Depot.objects.get_or_create(name='Unassigned Depot', region=region)
                transformer, _ = Transformer.objects.get_or_create(transformer_id='UNASSIGNED', defaults={'name':'Unassigned Transformer','region':region,'depot':depot,'capacity':0})
                device.transformer = transformer
                device.save()
            return device.transformer

        def handle_up(msg):
            deveui = None
            for k in ['EUI','devEui','deveui','DevEUI','eui','id']:
                v = msg.get(k)
                if isinstance(v, str) and v.strip():
                    deveui = v.strip()
                    break
            if not deveui:
                return
            port = None
            for k in ['port','fPort']:
                v = msg.get(k)
                try:
                    if v is not None:
                        port = int(v)
                        break
                except Exception:
                    pass
            device, _ = Device.objects.get_or_create(deveui=deveui, defaults={'name': deveui})
            device.last_seen = timezone.now()
            transformer = ensure_transformer(device)
            raw_data_field = msg.get('data') or msg.get('Data')
            buf = to_bytes(raw_data_field)
            device_codec_hint = device.codec or (device.metadata or {}).get('codec')
            decoded = decode_vendor(buf, device_codec_hint)
            value = None
            if isinstance(decoded, dict):
                value = decoded.get('primary_value')
            meta = {
                **(device.metadata or {}),
                'last_payload': msg,
                'last_value': value,
                'last_port': port,
                'last_decoded': decoded,
                'codec': (decoded.get('codec') if decoded else None),
            }
            try:
                if decoded and decoded.get('codec'):
                    if not device.codec or device.codec != decoded['codec']:
                        device.codec = decoded['codec']
            except Exception:
                pass
            device.metadata = meta
            device.save()
            if port is not None:
                sensor_key = f"{deveui}-{port}"
                sensor, _ = Sensor.objects.get_or_create(sensor_id=sensor_key, transformer=transformer, defaults={'name':f"{deveui} Port {port}", 'sensor_type':'other'})
                if not sensor.dev_eui:
                    sensor.dev_eui = deveui
                if sensor.fport is None:
                    sensor.fport = port
                sensor.meta = {**(sensor.meta or {}), 'loriot': msg}
                sensor.save()
                DeviceSensorMap.objects.get_or_create(device=device, port=port, sensor=sensor)
                DeviceUplink.objects.create(device=device, port=port, topic=f"loriot/{deveui}/{port}", raw=msg, value=(None if value is None else value), ts_device=None)
                SensorReading.objects.create(
                    sensor=sensor,
                    value=(None if value is None else value),
                    is_alert=False,
                    topic=f"loriot/{deveui}/{port}",
                    raw_payload=msg,
                    decoded=(decoded or None),
                    received_at=timezone.now()
                )
                try:
                    c = getattr(self, '_mqtt_client', None)
                    if c:
                        payload = {
                            'value': value,
                            'timestamp': timezone.now().strftime('%Y-%m-%dT%H:%M:%SZ'),
                            'deveui': deveui,
                            'port': port,
                            'decoded': decoded,
                        }
                        c.publish(f"powerteltais/{deveui}/{port}", json.dumps(payload), qos=int(getattr(settings, 'MQTT_QOS', 0)), retain=False)
                except Exception:
                    pass
                try:
                    from api.realtime_views import push_device_update, push_sensor_update
                    push_device_update(device.id, port=port, value=value, codec=(decoded.get('codec') if decoded else None))
                    push_sensor_update(sensor.id, value, False)
                except Exception:
                    pass
                try:
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync
                    layer = get_channel_layer()
                    if layer:
                        payload = {
                            'type': 'broadcast.message',
                            'deveui': deveui,
                            'sensor_id': sensor.id,
                            'transformer_id': transformer.id if transformer else None,
                            'port': port,
                            'value': value,
                            'codec': (decoded.get('codec') if decoded else None),
                            'timestamp': int(timezone.now().timestamp()*1000)
                        }
                        async_to_sync(layer.group_send)(f'sensor_{sensor.id}', payload)
                        if transformer:
                            async_to_sync(layer.group_send)(f'transformer_{transformer.id}', payload)
                except Exception:
                    pass

        def on_open(ws):
            try:
                self.stdout.write(self.style.SUCCESS(f'Connected to {url}'))
            except Exception:
                pass

        def on_message(ws, message):
            try:
                data = json.loads(message)
            except Exception:
                try:
                    self.stderr.write(self.style.ERROR('Invalid JSON message'))
                except Exception:
                    pass
                return
            cmd = data.get('cmd') or data.get('type')
            try:
                self.stdout.write(f'RECV cmd={cmd}')
            except Exception:
                pass
            if cmd in ('up', 'rx'):
                handle_up(data)

        def on_error(ws, error):
            try:
                self.stderr.write(self.style.ERROR(str(error)))
            except Exception:
                pass

        def on_close(ws, code, reason):
            try:
                self.stderr.write(f'Closed: code={code} reason={reason}')
            except Exception:
                pass

        # Prepare optional MQTT mirroring client
        self._mqtt_client = None
        try:
            if getattr(settings, 'MQTT_MIRROR_FROM_LORIOT', False) and mqtt is not None:
                host = getattr(settings, 'MQTT_BROKER_HOST', None) or os.getenv('MQTT_BROKER_HOST') or ''
                port = int(getattr(settings, 'MQTT_BROKER_PORT', None) or os.getenv('MQTT_BROKER_PORT') or '0')
                user = getattr(settings, 'MQTT_USERNAME', None) or os.getenv('MQTT_USERNAME') or ''
                password = getattr(settings, 'MQTT_PASSWORD', None) or os.getenv('MQTT_PASSWORD') or ''
                client_id = f"tais-loriot-mirror-{os.getpid()}"
                c = mqtt.Client(client_id=client_id)
                if user:
                    c.username_pw_set(user, password)
                if port == 8883:
                    try:
                        c.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS)
                    except Exception:
                        c.tls_set()
                if host and port:
                    c.connect(host, port, keepalive=60)
                    self._mqtt_client = c
        except Exception:
            self._mqtt_client = None

        ws = websocket.WebSocketApp(url, on_open=on_open, on_message=on_message, on_error=on_error, on_close=on_close)
        sslopt = {}
        if not insecure:
            sslopt = {"cert_reqs": ssl.CERT_REQUIRED, "ssl_version": ssl.PROTOCOL_TLS}
        run_seconds = int(options.get('run-seconds') or 0)
        if run_seconds > 0:
            import threading, time
            t = threading.Thread(target=lambda: ws.run_forever(sslopt=sslopt, ping_interval=30, ping_timeout=10))
            t.daemon = True
            t.start()
            try:
                time.sleep(run_seconds)
            finally:
                try:
                    ws.close()
                except Exception:
                    pass
        else:
            ws.run_forever(sslopt=sslopt, ping_interval=30, ping_timeout=10)