import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { ActivityIndicator, View, TouchableOpacity, Image, Text } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen'; // Transformers List
import SimulationScreen from '../screens/SimulationScreen';
import TransformerDetailsScreen from '../screens/TransformerDetailsScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MapScreen from '../screens/MapScreen';
import RegionListScreen from '../screens/RegionListScreen';
import DistrictListScreen from '../screens/DistrictListScreen';
import DepotListScreen from '../screens/DepotListScreen';
import TransformerCrudScreen from '../screens/TransformerCrudScreen';
import NewSensorsScreen from '../screens/NewSensorsScreen'; // Re-verified
import CameraFormScreen from '../screens/CameraFormScreen';
import RegionFormScreen from '../screens/RegionFormScreen';
import DistrictFormScreen from '../screens/DistrictFormScreen';
import DepotFormScreen from '../screens/DepotFormScreen';
import TransformerFormScreen from '../screens/TransformerFormScreen';
import CameraImagesScreen from '../screens/CameraImagesScreen';
// import LogoutButton from '../components/LogoutButton';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const TransformersStack = createNativeStackNavigator();

const CustomDrawerContent = (props) => {
  const { signOut } = useContext(AuthContext);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={{ padding: 24, backgroundColor: '#0067A5', marginBottom: 8 }}>
        <View style={{ 
          width: 64, 
          height: 64, 
          borderRadius: 32, 
          backgroundColor: 'white', 
          justifyContent: 'center', 
          alignItems: 'center',
          marginBottom: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4
        }}>
           <Image 
            source={require('../../assets/images/powertel_logo.jpg')} 
            style={{ width: 40, height: 40, borderRadius: 20 }}
            resizeMode="contain"
          />
        </View>
        <Text style={{ color: 'white', fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 4 }}>Smart Monitoring</Text>
      </View>
      
      <View style={{ flex: 1, paddingTop: 8 }}>
        <DrawerItemList {...props} />
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 4, paddingBottom: 20 }}>
        <DrawerItem
          label="Logout"
          icon={({ color, size }) => (
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          )}
          onPress={() => signOut()}
          labelStyle={{ marginLeft: -10, fontSize: 12, fontFamily: 'Inter_500Medium', color: '#EF4444' }}
          style={{ marginTop: 0 }}
        />
      </View>
    </DrawerContentScrollView>
  );
};

const TransformersStackNavigator = () => {
  return (
    <TransformersStack.Navigator>
      <TransformersStack.Screen 
        name="TransformersList" 
        component={DashboardScreen} 
        options={{ headerShown: false }}
      />
      <TransformersStack.Screen 
        name="TransformerDetails" 
        component={TransformerDetailsScreen} 
        options={{ 
            title: 'Transformer Details',
            // headerRight: () => <LogoutButton />,
            headerTitleStyle: { fontFamily: 'Inter_600SemiBold' },
        }} 
      />
    </TransformersStack.Navigator>
  );
};

const DrawerNavigator = () => {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ route }) => ({
        headerShown: true,
        // headerRight: () => <LogoutButton />,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 18 },
        headerStyle: { elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
        drawerActiveBackgroundColor: '#F0F9FF',
        drawerActiveTintColor: '#0067A5',
        drawerInactiveTintColor: '#4B5563',
        drawerItemStyle: { borderRadius: 8, marginHorizontal: 12, marginVertical: 0 },
        drawerLabelStyle: {
          marginLeft: 0,
          fontSize: 12,
          fontFamily: 'Inter_500Medium',
        },
        drawerIcon: ({ focused, color, size }) => {
          let iconName;
          const iconSize = 22;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'grid' : 'grid-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Simulation') {
            iconName = focused ? 'construct' : 'construct-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Map') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Regions') {
            iconName = focused ? 'globe' : 'globe-outline';
          } else if (route.name === 'Districts') {
            iconName = focused ? 'business' : 'business-outline';
          } else if (route.name === 'Depots') {
            iconName = focused ? 'cube' : 'cube-outline';
          } else if (route.name === 'Transformers Mgmt') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else if (route.name === 'New Sensors') {
            iconName = focused ? 'hardware-chip' : 'hardware-chip-outline';
          }

          return <Ionicons name={iconName} size={iconSize} color={color} />;
        },
      })}
    >
      <Drawer.Screen 
        name="Dashboard" 
        component={TransformersStackNavigator} 
        options={{ headerShown: false }}
      />
      <Drawer.Screen name="Alerts" component={AlertsScreen} />
      <Drawer.Screen name="Simulation" component={SimulationScreen} />
      <Drawer.Screen name="Map" component={MapScreen} />
      <Drawer.Screen name="Regions" component={RegionListScreen} />
      <Drawer.Screen name="Districts" component={DistrictListScreen} />
      <Drawer.Screen name="Depots" component={DepotListScreen} />
      <Drawer.Screen 
        name="Transformers Mgmt" 
        component={TransformerCrudScreen} 
        options={{ title: 'Transformers' }}
      />
      <Drawer.Screen name="New Sensors" component={NewSensorsScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
    </Drawer.Navigator>
  );
};

const AppNavigator = () => {
  const { userToken, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 20 }}>Verifying User...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen name="MainApp" component={DrawerNavigator} />
        )}
        <Stack.Screen 
          name="CameraForm" 
          component={CameraFormScreen} 
          options={{ headerShown: true, title: 'Camera' }}
        />
        <Stack.Screen 
          name="RegionForm" 
          component={RegionFormScreen} 
          options={{ headerShown: true, title: 'Region' }}
        />
        <Stack.Screen 
          name="DistrictForm" 
          component={DistrictFormScreen} 
          options={{ headerShown: true, title: 'District' }}
        />
        <Stack.Screen 
          name="DepotForm" 
          component={DepotFormScreen} 
          options={{ headerShown: true, title: 'Depot' }}
        />
        <Stack.Screen 
          name="TransformerForm" 
          component={TransformerFormScreen} 
          options={{ headerShown: true, title: 'Transformer' }}
        />
         <Stack.Screen 
          name="CameraImages" 
          component={CameraImagesScreen} 
          options={{ headerShown: true, title: 'Camera Images' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;