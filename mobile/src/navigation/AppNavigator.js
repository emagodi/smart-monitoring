import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { ActivityIndicator, View, TouchableOpacity } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import Ionicons from '@expo/vector-icons/Ionicons';

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

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const TransformersStack = createNativeStackNavigator();

const CustomDrawerContent = (props) => {
  const { signOut } = useContext(AuthContext);

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <View style={{ height: 1, backgroundColor: '#e0e0e0', marginVertical: 10 }} />
      <DrawerItem
        label="Logout"
        icon={({ color, size }) => (
          <Ionicons name="log-out-outline" size={size} color={color} />
        )}
        onPress={() => signOut()}
        labelStyle={{ marginLeft: 0, fontSize: 16 }}
        inactiveTintColor="#333"
      />
    </DrawerContentScrollView>
  );
};

const TransformersStackNavigator = () => {
  return (
    <TransformersStack.Navigator>
      <TransformersStack.Screen 
        name="TransformersList" 
        component={DashboardScreen} 
        options={({ navigation }) => ({
          title: 'Transformers',
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.openDrawer()} style={{ marginRight: 15 }}>
              <Ionicons name="menu" size={24} color="#000" />
            </TouchableOpacity>
          ),
        })} 
      />
      <TransformersStack.Screen 
        name="TransformerDetails" 
        component={TransformerDetailsScreen} 
        options={{ title: 'Transformer Details' }} 
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
        drawerActiveTintColor: '#0067A5',
        drawerInactiveTintColor: '#333',
        drawerLabelStyle: {
          marginLeft: 0,
          fontSize: 16,
        },
        drawerIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Transformers') {
            iconName = focused ? 'flash' : 'flash-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'warning' : 'warning-outline';
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
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Drawer.Screen 
        name="Transformers" 
        component={TransformersStackNavigator} 
        options={{ headerShown: false }}
      />
      <Drawer.Screen name="Alerts" component={AlertsScreen} />
      <Drawer.Screen name="Simulation" component={SimulationScreen} />
      <Drawer.Screen name="Map" component={MapScreen} />
      <Drawer.Screen name="Regions" component={RegionListScreen} />
      <Drawer.Screen name="Districts" component={DistrictListScreen} />
      <Drawer.Screen name="Depots" component={DepotListScreen} />
      <Drawer.Screen name="Transformers Mgmt" component={TransformerCrudScreen} />
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
