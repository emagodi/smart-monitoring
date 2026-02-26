import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import transformerService from '../services/transformer';
import alertService from '../services/alert';
import infrastructureService from '../services/infrastructure';
import sensorService from '../services/sensor';
import LogoutButton from '../components/LogoutButton';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState({
    totalTransformers: 0,
    activeTransformers: 0,
    maintenanceTransformers: 0,
    totalAlerts: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    totalSensors: 0,
    unassignedSensors: 0,
    totalDepots: 0,
    recentAlerts: []
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [transformersRes, alertsRes, depotsRes, sensorsRes, unassignedSensorsRes] = await Promise.all([
        transformerService.getAllTransformers(0, 1000).catch(() => []),
        alertService.getAllAlerts().catch(() => []),
        infrastructureService.getAllDepots(0, 1000).catch(() => []),
        sensorService.getAllSensors(0, 1000).catch(() => []),
        sensorService.getUnassignedSensors().catch(() => [])
      ]);

      const transformers = Array.isArray(transformersRes) ? transformersRes : (transformersRes.content || []);
      const alerts = Array.isArray(alertsRes) ? alertsRes : (alertsRes.content || []);
      const depots = Array.isArray(depotsRes) ? depotsRes : (depotsRes.content || []);
      const sensors = Array.isArray(sensorsRes) ? sensorsRes : (sensorsRes.content || []);
      const unassignedSensors = Array.isArray(unassignedSensorsRes) ? unassignedSensorsRes : [];

      const active = transformers.filter(t => t.active === true || t.isActive === true).length;
      
      const critical = alerts.filter(a => a.severity === 'CRITICAL' || a.message?.includes('CRITICAL') || a.message?.includes('Fire') || a.message?.includes('Intruder')).length;
      const warning = alerts.length - critical;

      const sortedAlerts = [...alerts].sort((a, b) => b.id - a.id).slice(0, 3);

      setStats({
        totalTransformers: transformers.length,
        activeTransformers: active,
        maintenanceTransformers: transformers.length - active,
        totalAlerts: alerts.length,
        criticalAlerts: critical,
        warningAlerts: warning,
        totalSensors: sensors.length,
        unassignedSensors: unassignedSensors.length,
        totalDepots: depots.length,
        recentAlerts: sortedAlerts
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const DashboardCard = ({ title, value, subtitle, icon, colors, onPress, fullWidth }) => (
    <TouchableOpacity 
        style={[styles.cardContainer, fullWidth ? styles.fullWidth : styles.halfWidth]} 
        onPress={onPress}
        activeOpacity={0.9}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
                <Ionicons name={icon} size={20} color="rgba(255,255,255,0.9)" />
            </View>
            <Text style={styles.cardTitle}>{title}</Text>
        </View>
        
        <View style={styles.cardCenter}>
            <Text style={styles.cardValue}>{value}</Text>
            {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </View>
        
        <View style={styles.cardDecorationCircle} />
      </LinearGradient>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title, actionText, onAction }) => (
    <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {actionText && (
            <TouchableOpacity onPress={onAction}>
                <Text style={styles.sectionAction}>{actionText}</Text>
            </TouchableOpacity>
        )}
    </View>
  );

  const AlertItem = ({ alert }) => (
    <View style={styles.alertItem}>
        <View style={[styles.alertIcon, { backgroundColor: (alert.severity === 'CRITICAL' || alert.message?.includes('Fire')) ? '#FEE2E2' : '#F0F9FF' }]}>
            <Ionicons 
                name={alert.message?.includes('Fire') ? "flame" : "notifications"} 
                size={20} 
                color={(alert.severity === 'CRITICAL' || alert.message?.includes('Fire')) ? '#DC2626' : '#0067A5'} 
            />
        </View>
        <View style={styles.alertContent}>
            <Text style={styles.alertMessage} numberOfLines={1}>{alert.message || 'System Alert'}</Text>
            <Text style={styles.alertTime}>{alert.timestamp ? new Date(alert.timestamp).toLocaleString() : ''}</Text>
        </View>
        {/* <Ionicons name="chevron-forward" size={16} color="#9CA3AF" /> */}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuButton}>
              <Ionicons name="menu" size={28} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
             <LogoutButton />
          </View>
      </View>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchStats} colors={['#0067A5']} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerTextContainer}>
            <Text style={styles.headerSubtitle}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        </View>

        <View style={styles.gridContainer}>
            <DashboardCard 
                title="Transformers" 
                value={stats.totalTransformers} 
                subtitle={`${stats.activeTransformers} Active • ${stats.maintenanceTransformers} Maint.`}
                icon="flash" 
                colors={['#0067A5', '#0284C7']} 
                onPress={() => navigation.navigate('Transformers Mgmt')}
                fullWidth
            />
            <DashboardCard 
                title="Depots" 
                value={stats.totalDepots} 
                icon="business" 
                colors={['#4F46E5', '#6366F1']} 
                onPress={() => navigation.navigate('Depots')}
            />
             <DashboardCard 
                title="Sensors" 
                value={stats.totalSensors} 
                subtitle={`${stats.unassignedSensors} Unassigned`}
                icon="hardware-chip" 
                colors={['#059669', '#10B981']} 
                onPress={() => navigation.navigate('New Sensors')}
            />
        </View>

        <SectionHeader title="Alert Status" actionText="View All" onAction={() => navigation.navigate('Alerts')} />
        <View style={styles.gridContainer}>
             <DashboardCard 
                title="Total Alerts" 
                value={stats.totalAlerts} 
                icon="notifications" 
                colors={['#475569', '#64748B']} 
                onPress={() => navigation.navigate('Alerts')}
            />
             <DashboardCard 
                title="Critical" 
                value={stats.criticalAlerts} 
                icon="alert-circle" 
                colors={['#DC2626', '#EF4444']} 
                onPress={() => navigation.navigate('Alerts')}
            />
        </View>

        <View style={styles.recentAlertsContainer}>
            <Text style={styles.recentAlertsTitle}>Recent Activity</Text>
            <View style={styles.recentAlertsList}>
                {stats.recentAlerts.length > 0 ? (
                    stats.recentAlerts.map((alert, index) => (
                        <View key={alert.id || index}>
                            <AlertItem alert={alert} />
                            {index < stats.recentAlerts.length - 1 && <View style={styles.divider} />}
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyStateText}>No recent alerts</Text>
                )}
            </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20, // Adjust for status bar
    paddingBottom: 10,
    backgroundColor: '#F3F4F6',
    zIndex: 10,
  },
  menuButton: {
    padding: 8,
    marginLeft: -8,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 10,
  },
  headerTextContainer: {
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#374151',
  },
  sectionAction: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#0067A5',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardContainer: {
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  fullWidth: {
    width: '100%',
  },
  halfWidth: {
    width: (width - 48) / 2,
  },
  cardGradient: {
    padding: 12,
    borderRadius: 16,
    height: 100,
    position: 'relative',
    overflow: 'hidden',
  },
  cardDecorationCircle: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    zIndex: 1,
  },
  cardValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 8,
  },
  cardSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  recentAlertsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  recentAlertsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#111827',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  recentAlertsList: {
    padding: 0,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 4,
  },
  alertTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 68,
  },
  emptyStateText: {
    padding: 24,
    textAlign: 'center',
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});

export default DashboardScreen;
