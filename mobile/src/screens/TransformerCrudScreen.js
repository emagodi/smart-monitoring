import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import CrudScreen from '../components/CrudScreen';
import LogoutButton from '../components/LogoutButton';
import transformerService from '../services/transformer';
import infrastructureService from '../services/infrastructure';
import sensorService from '../services/sensor';
import cameraService from '../services/camera';

const TransformerCrudScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { transformer, viewLevel: initialViewLevel, action } = route.params || {};

    const [viewLevel, setViewLevel] = useState('regions'); // 'regions', 'districts', 'depots', 'transformers', 'sensors'
    const [selectedRegion, setSelectedRegion] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState(null);
    const [selectedDepot, setSelectedDepot] = useState(null);
    const [selectedTransformer, setSelectedTransformer] = useState(null);
    const [selectedSensor, setSelectedSensor] = useState(null);

    useEffect(() => {
        if (transformer) {
            setSelectedTransformer(transformer);
        }
        if (initialViewLevel) {
            setViewLevel(initialViewLevel);
        }
    }, [transformer, initialViewLevel]);

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: 'Transformers',
            headerRight: () => <LogoutButton />,
        });
    }, [navigation]);

    // Transformer fields
    const transformerFields = [
        { name: 'name', label: 'Transformer Name', placeholder: 'Enter transformer name', required: true },
        // Depot is pre-selected
        { name: 'capacity', label: 'Capacity (KVA)', placeholder: 'Enter capacity', keyboardType: 'numeric' },
        { 
            name: 'location', 
            label: 'Location', 
            type: 'location', 
            latField: 'lat', 
            lngField: 'lng',
            placeholder: 'Tap to select location' 
        },
        { 
            name: 'status', 
            label: 'Status', 
            type: 'selector', 
            fetchOptions: async () => [
                { id: 'active', name: 'Active' }, 
                { id: 'maintenance', name: 'Maintenance' }
            ],
            labelKey: 'statusLabel',
            valueKey: 'id'
        }
    ];

    // Camera fields
    const cameraFields = [
        { name: 'name', label: 'Camera Name', placeholder: 'Enter camera name', required: true },
        { name: 'topic', label: 'MQTT Topic', placeholder: 'Enter MQTT topic', required: true },
        { name: 'model', label: 'Camera Model', placeholder: 'Enter camera model' },
        { name: 'ipAddress', label: 'IP Address', placeholder: 'Enter IP address' },
        { name: 'macAddress', label: 'MAC Address', placeholder: 'Enter MAC address' },
        { name: 'wifiSsid', label: 'WiFi SSID', placeholder: 'Enter WiFi SSID' }
    ];

    const fetchTransformers = async (page, size, search) => {
        if (!selectedDepot) return { content: [] };
        // Fetch by depot
        try {
            const data = await transformerService.getTransformersByDepot(selectedDepot.id);
            // Client-side search filtering
            let filteredData = data;
            if (search) {
                const query = search.toLowerCase();
                filteredData = data.filter(t => t.name.toLowerCase().includes(query));
            }
            
            // Map status for display
            return filteredData.map(t => ({
                ...t,
                status: t.isActive ? 'active' : 'maintenance',
                statusLabel: t.isActive ? 'Active' : 'Maintenance'
            }));
        } catch (error) {
            console.error('Error fetching transformers:', error);
            return [];
        }
    };

    const transformDataBeforeSubmit = (data, editingItem, selectorLabels) => {
        return {
            name: data.name,
            depotId: selectedDepot.id, // Use selected depot ID
            depotName: selectedDepot.name, // Use selected depot name
            capacity: parseInt(data.capacity, 10) || 0,
            isActive: data.status === 'active',
            lat: parseFloat(data.lat) || 0.0,
            lng: parseFloat(data.lng) || 0.0
        };
    };

    // Navigation handlers
    const handleSelectRegion = (region) => {
        setSelectedRegion(region);
        setViewLevel('districts');
    };

    const handleSelectDistrict = (district) => {
        setSelectedDistrict(district);
        setViewLevel('depots');
    };

    const handleSelectDepot = (depot) => {
        setSelectedDepot(depot);
        setViewLevel('transformers');
    };

    const handleSelectTransformerForSensors = (transformer) => {
        setSelectedTransformer(transformer);
        setViewLevel('sensors');
    };

    const handleSelectTransformerForCameras = (transformer) => {
        setSelectedTransformer(transformer);
        setViewLevel('cameras');
    };

    const handleSelectSensor = (sensor) => {
        setSelectedSensor(sensor);
        setViewLevel('sensor_readings');
    };

    const handleBack = () => {
        if (viewLevel === 'sensor_readings') setViewLevel('sensors');
        else if (viewLevel === 'sensors') setViewLevel('transformers');
        else if (viewLevel === 'cameras') setViewLevel('transformers');
        else if (viewLevel === 'transformers') setViewLevel('depots');
        else if (viewLevel === 'depots') setViewLevel('districts');
        else if (viewLevel === 'districts') setViewLevel('regions');
    };

    // Render custom item for Regions
    const renderRegionItem = (item, onEdit, onDelete) => (
        <TouchableOpacity onPress={() => handleSelectRegion(item)} style={[styles.card, styles.regionCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <LinearGradient colors={['#4fc3f7', '#0288d1']} style={styles.iconContainer}>
                    <Ionicons name="map" size={20} color="#fff" />
                </LinearGradient>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                </View>
            </View>
            
            <View style={styles.cardActions}>
                 <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                    <Ionicons name="create-outline" size={20} color="#4CAF50" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
                 <Ionicons name="chevron-forward" size={18} color="#bdbdbd" style={{ marginLeft: 8 }} />
            </View>
        </TouchableOpacity>
    );

    // Render custom item for Districts
    const renderDistrictItem = (item, onEdit, onDelete) => (
        <TouchableOpacity onPress={() => handleSelectDistrict(item)} style={[styles.card, styles.districtCard]}>
             <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <LinearGradient colors={['#66bb6a', '#388e3c']} style={styles.iconContainer}>
                    <Ionicons name="business" size={20} color="#fff" />
                </LinearGradient>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                </View>
            </View>

            <View style={styles.cardActions}>
                 <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                    <Ionicons name="create-outline" size={20} color="#4CAF50" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color="#bdbdbd" style={{ marginLeft: 8 }} />
            </View>
        </TouchableOpacity>
    );

    // Render custom item for Depots
    const renderDepotItem = (item, onEdit, onDelete) => (
        <TouchableOpacity onPress={() => handleSelectDepot(item)} style={[styles.card, styles.depotCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <LinearGradient colors={['#ffca28', '#f57c00']} style={styles.iconContainer}>
                    <Ionicons name="home" size={20} color="#fff" />
                </LinearGradient>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                </View>
            </View>

            <View style={styles.cardActions}>
                 <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                    <Ionicons name="create-outline" size={20} color="#4CAF50" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={18} color="#bdbdbd" style={{ marginLeft: 8 }} />
            </View>
        </TouchableOpacity>
    );

    const getSensorIcon = (type) => {
        const lowerType = type ? type.toLowerCase() : '';
        if (lowerType.includes('temp')) return { name: 'thermometer', colors: ['#ff7043', '#d84315'] };
        if (lowerType.includes('contact')) return { name: 'radio-button-on', colors: ['#5c6bc0', '#3949ab'] };
        if (lowerType.includes('motion')) return { name: 'walk', colors: ['#ffa726', '#ef6c00'] };
        if (lowerType.includes('tilt')) return { name: 'navigate', colors: ['#26c6da', '#0097a7'] };
        if (lowerType.includes('oil')) return { name: 'water', colors: ['#42a5f5', '#1565c0'] };
        if (lowerType.includes('vib')) return { name: 'pulse', colors: ['#ab47bc', '#7b1fa2'] };
        if (lowerType.includes('sound') || lowerType.includes('noise')) return { name: 'volume-high', colors: ['#26a69a', '#00695c'] };
        if (lowerType.includes('camera') || lowerType.includes('vision')) return { name: 'camera', colors: ['#7e57c2', '#512da8'] };
        if (lowerType.includes('volt')) return { name: 'flash', colors: ['#fdd835', '#fbc02d'] };
        return { name: 'hardware-chip', colors: ['#78909c', '#455a64'] };
    };

    // Render custom item for Sensors
    const renderSensorItem = (item, onEdit, onDelete) => {
        const { name, colors } = getSensorIcon(item.type);
        return (
            <TouchableOpacity onPress={() => handleSelectSensor(item)} style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
                <LinearGradient colors={colors} style={styles.iconContainer}>
                    <Ionicons name={name} size={16} color="#fff" />
                </LinearGradient>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.type}</Text>
                </View>
                 <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
            </TouchableOpacity>
        );
    };

    // Render custom item for Sensor Readings
    const renderReadingItem = (item) => {
        let dateStr = 'N/A';
        try {
            if (item.timestamp) {
                const d = new Date(item.timestamp);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleString();
                } else {
                    dateStr = item.timestamp; // Show raw string if parsing fails but exists
                }
            }
        } catch (e) {}

        return (
            <View style={[styles.card, { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 12 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
                    <Text style={styles.readingValue}>{String(item.value)}</Text>
                    <Text style={styles.readingTime}>{dateStr}</Text>
                </View>
            </View>
        );
    };

    // Render custom item for Cameras
    const renderCameraItem = (item, onEdit, onDelete) => (
        <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <LinearGradient colors={['#7e57c2', '#512da8']} style={styles.iconContainer}>
                        <Ionicons name="camera" size={16} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <Text style={styles.cardSubtitle}>{item.model} • {item.topic}</Text>
                        <View style={styles.statusBadge}>
                             <View style={[styles.statusDot, { backgroundColor: item.status === 'ACTIVE' ? '#4CAF50' : '#F44336' }]} />
                             <Text style={[styles.statusText, { color: item.status === 'ACTIVE' ? '#4CAF50' : '#F44336' }]}>
                                {item.status || 'Unknown'}
                             </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                        <Ionicons name="create-outline" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                <TouchableOpacity 
                    style={[styles.viewSensorsButton, { backgroundColor: '#0067A5', paddingHorizontal: 16 }]}
                    onPress={() => navigation.navigate('CameraImages', { cameraId: item.id, cameraName: item.name })}
                >
                    <Text style={styles.viewSensorsText}>Images</Text>
                    <Ionicons name="images" size={14} color="#fff" style={{ marginLeft: 6 }} />
                </TouchableOpacity>
            </View>
        </View>
    );

    // Render custom item for Transformers
    const renderTransformerItem = (item, onEdit, onDelete) => (
        <View style={[styles.card, { flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ marginBottom: 4 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <LinearGradient 
                        colors={item.isActive ? ['#66bb6a', '#2e7d32'] : ['#ef5350', '#c62828']} 
                        style={styles.iconContainer}
                    >
                        <Ionicons name="flash" size={16} color="#fff" />
                    </LinearGradient>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardSubtitle}>{item.capacity} KVA • {item.depotName}</Text>
                        <View style={styles.statusBadge}>
                             <View style={[styles.statusDot, { backgroundColor: item.isActive ? '#4CAF50' : '#F44336' }]} />
                             <Text style={[styles.statusText, { color: item.isActive ? '#4CAF50' : '#F44336' }]}>
                                {item.isActive ? 'Active' : 'Maintenance'}
                             </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
                        <Ionicons name="create-outline" size={20} color="#4CAF50" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
                        <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <TouchableOpacity 
                    style={[styles.viewSensorsButton, { flex: 1, marginRight: 5 }]}
                    onPress={() => handleSelectTransformerForSensors(item)}
                >
                    <Text style={styles.viewSensorsText}>View Sensors</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.viewSensorsButton, { flex: 1, marginLeft: 5, backgroundColor: '#7e57c2' }]}
                    onPress={() => handleSelectTransformerForCameras(item)}
                >
                    <Text style={styles.viewSensorsText}>View Cameras</Text>
                    <Ionicons name="chevron-forward" size={12} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
    );

    // Dynamic props for CrudScreen
    let screenProps = {};

    switch (viewLevel) {
        case 'regions':
            screenProps = {
                title: 'Regions',
                fetchData: infrastructureService.getAllRegions, // Returns Page object
                fields: [{ name: 'name', label: 'Name' }], // Minimal fields for search
                renderCustomItem: (item, onEdit, onDelete) => renderRegionItem(item, onEdit, onDelete),
                createItem: infrastructureService.createRegion,
                updateItem: infrastructureService.updateRegion,
                deleteItem: infrastructureService.deleteRegion,
                onAddPress: () => navigation.navigate('RegionForm'),
                onEditPress: (item) => navigation.navigate('RegionForm', { region: item }),
                onBack: null // Root level
            };
            break;
        case 'districts':
            screenProps = {
                title: 'Districts',
                subtitle: selectedRegion?.name,
                fetchData: async (page, size, search) => {
                    const data = await infrastructureService.getDistrictsByRegion(selectedRegion.id);
                    if (search) return data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
                    return data;
                },
                fields: [{ name: 'name', label: 'Name' }],
                renderCustomItem: (item, onEdit, onDelete) => renderDistrictItem(item, onEdit, onDelete),
                createItem: infrastructureService.createDistrict,
                updateItem: infrastructureService.updateDistrict,
                deleteItem: infrastructureService.deleteDistrict,
                onAddPress: () => navigation.navigate('DistrictForm', { regionId: selectedRegion?.id }),
                onEditPress: (item) => navigation.navigate('DistrictForm', { district: item, regionId: selectedRegion?.id }),
                onBack: handleBack
            };
            break;
        case 'depots':
            screenProps = {
                title: 'Depots',
                subtitle: selectedDistrict?.name,
                fetchData: async (page, size, search) => {
                    const data = await infrastructureService.getDepotsByDistrict(selectedDistrict.id);
                    if (search) return data.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
                    return data;
                },
                fields: [{ name: 'name', label: 'Name' }],
                renderCustomItem: (item, onEdit, onDelete) => renderDepotItem(item, onEdit, onDelete),
                createItem: infrastructureService.createDepot,
                updateItem: infrastructureService.updateDepot,
                deleteItem: infrastructureService.deleteDepot,
                onAddPress: () => navigation.navigate('DepotForm', { districtId: selectedDistrict?.id }),
                onEditPress: (item) => navigation.navigate('DepotForm', { depot: item, districtId: selectedDistrict?.id }),
                onBack: handleBack
            };
            break;
        case 'transformers':
            screenProps = {
                title: `Transformers`,
                subtitle: selectedDepot?.name,
                fetchData: fetchTransformers,
                fields: transformerFields,
                createItem: transformerService.createTransformer,
                updateItem: transformerService.updateTransformer,
                deleteItem: transformerService.deleteTransformer,
                transformDataBeforeSubmit: transformDataBeforeSubmit,
                entityName: 'Transformer',
                onBack: handleBack,
                addButtonLabel: 'Add Transformer',
                renderCustomItem: renderTransformerItem, // Override default render to show nice card
                onAddPress: () => navigation.navigate('TransformerForm', { depotId: selectedDepot?.id, depotName: selectedDepot?.name }),
                onEditPress: (item) => navigation.navigate('TransformerForm', { transformer: item, depotId: selectedDepot?.id, depotName: selectedDepot?.name })
            };
            break;
        case 'sensors':
            screenProps = {
                title: 'Sensors',
                subtitle: selectedTransformer?.name,
                fetchData: async (page, size, search) => {
                     // Sensor service typically returns a list, not a Page object, so we wrap it
                     try {
                        const data = await sensorService.getSensorsByTransformer(selectedTransformer.id);
                        let result = data;
                        if (search) {
                            result = data.filter(s => s.type.toLowerCase().includes(search.toLowerCase()) || s.id.toString().includes(search));
                        }

                        // Sort order: Temperature -> Contact -> Motion -> Tilt -> Others
                        const priority = ['temp', 'contact', 'motion', 'tilt'];
                        return result.sort((a, b) => {
                            const typeA = a.type ? a.type.toLowerCase() : '';
                            const typeB = b.type ? b.type.toLowerCase() : '';
                            
                            const getPriority = (t) => {
                                const index = priority.findIndex(p => t.includes(p));
                                return index === -1 ? 999 : index;
                            };
                            
                            const pA = getPriority(typeA);
                            const pB = getPriority(typeB);
                            
                            if (pA !== pB) return pA - pB;
                            return typeA.localeCompare(typeB);
                        });
                     } catch (error) {
                         console.error("Error fetching sensors", error);
                         return [];
                     }
                },
                fields: [{ name: 'type', label: 'Sensor Type' }], // Basic field for now
                renderCustomItem: (item) => renderSensorItem(item),
                createItem: null, // Read-only for now as per request "open all sensors"
                onBack: handleBack
            };
            break;
        case 'cameras':
            screenProps = {
                title: 'Cameras',
                subtitle: selectedTransformer?.name,
                fetchData: async (page, size, search) => {
                    try {
                        const data = await cameraService.getByTransformerId(selectedTransformer.id);
                        if (search) {
                            const query = search.toLowerCase();
                            return data.filter(c => c.name.toLowerCase().includes(query) || c.topic.toLowerCase().includes(query));
                        }
                        return data;
                    } catch (error) {
                        console.error("Error fetching cameras", error);
                        return [];
                    }
                },
                fields: cameraFields,
                createItem: cameraService.registerCamera,
                updateItem: cameraService.updateCamera,
                deleteItem: null, // Handle manually via modal
                onAddPress: () => navigation.navigate('CameraForm', { transformerId: selectedTransformer.id }),
                onEditPress: (item) => navigation.navigate('CameraForm', { transformerId: selectedTransformer.id, camera: item }),
                transformDataBeforeSubmit: (data) => ({
                    ...data,
                    transformerId: selectedTransformer.id
                }),
                entityName: 'Camera',
                addButtonLabel: 'Add Camera',
                renderCustomItem: renderCameraItem,
                onBack: handleBack,
                autoOpenCreate: action === 'add' // Auto open create if navigated with action='add'
            };
            break;
        case 'sensor_readings':
            screenProps = {
                title: 'Readings',
                subtitle: selectedSensor?.type,
                filterType: 'date_range',
                fetchData: async (page, size, filters) => {
                     try {
                        let startDate = null;
                        let endDate = null;

                        if (filters && typeof filters === 'object') {
                             if (filters.startDate) {
                                 if (filters.startDate.length === 10) startDate = `${filters.startDate}T00:00:00`;
                                 else startDate = filters.startDate;
                             }
                             if (filters.endDate) {
                                 if (filters.endDate.length === 10) endDate = `${filters.endDate}T23:59:59`;
                                 else endDate = filters.endDate;
                             }
                        }

                        const data = await sensorService.getReadingsBySensor(selectedSensor.id, startDate, endDate);
                        // Sort by timestamp desc
                        const sorted = data.sort((a, b) => {
                            const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                            const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                            return (tB || 0) - (tA || 0);
                        });

                        // If filtered, return all. If not, return top 10.
                        if (startDate && endDate) {
                            return sorted;
                        }
                        return sorted.slice(0, 10);
                     } catch (error) {
                         console.error("Error fetching readings", error);
                         return [];
                     }
                },
                fields: [{ name: 'value', label: 'Value' }], // Not really used for list
                renderCustomItem: (item) => renderReadingItem(item),
                createItem: null,
                onBack: handleBack,
                keyExtractor: (item, index) => item.id ? `${item.id}-${index}` : `reading-${index}`
            };
            break;
    }

    // Force re-mount of CrudScreen when viewLevel changes to reset state
    return (
        <CrudScreen
            key={viewLevel} 
            {...screenProps}
            showLogo={false}
            showTitle={false}
        />
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent
        marginHorizontal: 16,
        marginVertical: 2,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 0, // Removed border for cleaner look
    },
    iconContainer: {
        width: 30,
        height: 30,
        borderRadius: 8, // Squircle
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 1,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Inter_600SemiBold',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 11,
        color: '#757575',
        fontFamily: 'Inter_400Regular',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginRight: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '500',
        fontFamily: 'Inter_500Medium',
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        padding: 4,
        marginLeft: 2,
    },
    viewSensorsButton: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0067A5',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignSelf: 'center', // Center align the button
    },
    viewSensorsText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Inter_600SemiBold',
        marginRight: 4,
    },
    readingValue: {
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Inter_700Bold',
        color: '#333',
    },
    readingTime: {
        fontSize: 12,
        color: '#666',
        fontFamily: 'Inter_400Regular',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 10,
        width: '100%',
        maxWidth: 320,
    },
    warningIconContainer: {
        marginBottom: 16,
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderRadius: 40,
    },
    modalTitle: {
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
        color: '#111827',
        marginBottom: 8,
        textAlign: 'center',
    },
    modalMessage: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    modalConfirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
        color: '#374151',
    },
    modalConfirmText: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
        color: 'white',
    },
});

export default TransformerCrudScreen;
