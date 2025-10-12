import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

import Main from "./pages/main";
import Login from "./pages/login";
import Register from "./pages/register";
import Home from "./pages/home";
import Profile from "./pages/profile";
import Backpack from "./pages/backpack";
import DeleteAccount from "./pages/deleteAccount";

const Stack = createStackNavigator();

export default function Routes() {
    return (
        <NavigationContainer>
            <Stack.Navigator>
                <Stack.Screen
                    name="main"
                    component={Main}
                    options={{ headerShown: false }} 
                />
                <Stack.Screen 
                    name="login" 
                    component={Login} 
                    options={{ headerShown: false }} 
                />
                <Stack.Screen
                    name="register"
                    component={Register}
                    options={{ headerShown: false }} 
                />
                <Stack.Screen
                    name="home"
                    component={Home}
                    options={{ headerShown: false }} 
                />
                <Stack.Screen
                    name="profile"
                    component={Profile}
                    options={{ headerShown: false }} 
                />
                <Stack.Screen
                    name="backpack"
                    component={Backpack}
                    options={{ headerShown: false }} 
                />
                <Stack.Screen
                    name="deleteAccount"
                    component={DeleteAccount}
                    options={{ headerShown: false }} 
                />
            </Stack.Navigator>
        </NavigationContainer>
    )
}
