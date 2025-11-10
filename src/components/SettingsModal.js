import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ToastAndroid,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { LINKAPI, PORTAPI } from "../utils/global";
import { limparTokens, pegarTokens } from "../utils/validacoes";
import { useNavigation } from "@react-navigation/native";

export default function SettingsModal({
  visible,
  onClose,
  onToggleTheme,
  isDarkTheme,
}) {
  const navigation = useNavigation();
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);

  // 🔹 Carrega preferência ao abrir o modal
  useEffect(() => {
    const carregarPreferencia = async () => {
      const valor = await AsyncStorage.getItem("notificacoesAtivas");
      if (valor !== null) {
        setNotificacoesAtivas(valor === "true");
      }
    };
    carregarPreferencia();
  }, [visible]);

  // 🔹 Alterna o estado e salva
  const handleToggleNotificacoes = async (valor) => {
    setNotificacoesAtivas(valor);
    await AsyncStorage.setItem("notificacoesAtivas", valor ? "true" : "false");

    if (valor) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== "granted") {
          ToastAndroid.show(
            "Permissão de notificações negada.",
            ToastAndroid.SHORT
          );
          setNotificacoesAtivas(false);
          await AsyncStorage.setItem("notificacoesAtivas", "false");
          return;
        }
      }
      ToastAndroid.show("Notificações ativadas ✅", ToastAndroid.SHORT);
    } else {
      ToastAndroid.show("Notificações desativadas ❌", ToastAndroid.SHORT);
    }
  };

  // 🔹 Logout
  const handleLogout = async () => {
    try {
      const tokens = await pegarTokens();
      const { refreshToken } = tokens;

      if (!refreshToken) {
        ToastAndroid.show("Nenhum token encontrado", ToastAndroid.SHORT);
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      await fetch(LINKAPI + PORTAPI + "/usuarios/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: "Bearer " + refreshToken,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      await limparTokens();

      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
    } catch (error) {
      if (error.name === "AbortError") {
        ToastAndroid.show("Servidor demorou a responder", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show("Não foi possível sair da conta", ToastAndroid.SHORT);
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Configurações</Text>

          {/* Alternar notificações */}
          <View style={styles.option}>
            <Text style={styles.optionText}>Notificações de Peso</Text>
            <Switch
              value={notificacoesAtivas}
              onValueChange={handleToggleNotificacoes}
            />
          </View>

          {/* Alternar tema (mantido, opcional) */}
          {/*
          <View style={styles.option}>
            <Text style={styles.optionText}>Modo Escuro</Text>
            <Switch value={isDarkTheme} onValueChange={onToggleTheme} />
          </View>
          */}

          {/* Botão de sair */}
          <TouchableOpacity style={styles.option} onPress={handleLogout}>
            <Text style={[styles.optionText, { color: "red" }]}>
              Sair da conta
            </Text>
          </TouchableOpacity>

          {/* Fechar modal */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
  },
  optionText: {
    fontSize: 16,
  },
  closeBtn: {
    marginTop: 20,
    alignItems: "center",
  },
  closeText: {
    fontSize: 16,
    color: "blue",
  },
});
