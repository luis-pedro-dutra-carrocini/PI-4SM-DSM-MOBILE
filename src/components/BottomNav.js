import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function BottomNav({ navigation, onOpenSettings  }) {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity onPress={() => navigation.navigate("profile")}>
        <Ionicons name="person" size={28} color="black" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("backpack")}>
        <MaterialIcons name="backpack" size={28} color="black" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.reset({
          index: 0,
          routes: [{ name: "home" }],
        }) }>
        <Ionicons name="home" size={28} color="black" />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("reports")}>
        <Ionicons name="stats-chart" size={28} color="black" />
      </TouchableOpacity>

      <TouchableOpacity onPress={onOpenSettings}>
        <Ionicons name="settings" size={28} color="black" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 15,
    borderTopWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
});
