// reports.js

import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ToastAndroid, ScrollView, RefreshControl, ActivityIndicator, Alert, Modal, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { LINKAPI, PORTAPI } from "../utils/global";
import { validarTokens, pegarTokens } from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

export default function ReportScreen({ navigation }) {

  const [backpacks, setBackpacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);

  const fetchUserBackpacks = useCallback(async () => {
    try {
      const resposta = await validarTokens(0, navigation);
      if (resposta !== "true") {
        if (resposta === "false") return;
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);
      }

      let tokens = await pegarTokens();
      let { accessToken } = tokens;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${LINKAPI}${PORTAPI}/usuarios-mochilas/usuario/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json();
        ToastAndroid.show(errorData.error || "Erro ao buscar mochilas", ToastAndroid.SHORT);
        setBackpacks([]);
        return;
      }

      const data = await response.json();
      const backpacksData = Array.isArray(data.mochilas) ? data.mochilas : [];

      const formattedData = backpacksData.map((item) => ({
        ...item,
        DataInicioUso: item.DataInicioUso ? new Date(item.DataInicioUso) : null,
        DataFimUso: item.DataFimUso ? new Date(item.DataFimUso) : null,
      }));

      formattedData.sort((a, b) => {
        if (a.UsoStatus === "Usando" && b.UsoStatus !== "Usando") return -1;
        if (a.UsoStatus !== "Usando" && b.UsoStatus === "Usando") return 1;
        if (a.UsoStatus === "Último a Usar" && b.UsoStatus === "Último a Usar") {
          const dateA = a.DataFimUso || a.DataInicioUso;
          const dateB = b.DataFimUso || b.DataInicioUso;
          return dateB.getTime() - dateA.getTime();
        }
        return 0;
      });

      setBackpacks(formattedData);
    } catch (error) {
      if (error.name === "AbortError") {
        ToastAndroid.show("Servidor demorou a responder ao buscar mochilas", ToastAndroid.LONG);
      } else {
        console.log(error);
        ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.LONG);
      }
      setBackpacks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserBackpacks();
  }, [fetchUserBackpacks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserBackpacks();
  }, [fetchUserBackpacks]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10, alignItems: "center", textAlign: "center" }}>Carregando mochilas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Meus Relatórios</Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {backpacks.length === 0 ? (
          <Text style={styles.noBackpacksText}>
            Precisa-se de ter mochilas vinculadas a você para ver os relatórios delas.
          </Text>
        ) : (
          backpacks.map((backpack) => (
            <TouchableOpacity
              key={backpack.MochilaCodigo}
              style={[
                styles.backpackCard,
                backpack.UsoStatus === "Usando" ? styles.inUseCard : styles.lastUsedCard,
              ]}
              onPress={() => navigation.navigate("reportingOptions", { codigo: backpack.MochilaCodigo, nome: backpack.MochilaNome })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.backpackName}>{backpack.MochilaNome}</Text>
              </View>

              <Text style={styles.statusLabel}>Código: ({backpack.MochilaCodigo})</Text>
              <Text style={styles.backpackDescription}>
                Descrição: {backpack.MochilaDescricao}
              </Text>
            </TouchableOpacity>
          ))
        )}

      </ScrollView>

      {/* Modal de Configurações */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onToggleTheme={() => setDarkTheme(!darkTheme)}
        isDarkTheme={darkTheme}
        onLogout={() => {
          setSettingsVisible(false);
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        }}
      />

      {/* Barra inferior reutilizável */}
      <BottomNav
        navigation={navigation}
        onOpenSettings={() => setSettingsVisible(true)} // passa a função
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eee",
    paddingTop: 50,
  },
  loadingContainer: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3A3A3A",
    marginBottom: 20,
    alignItems: "center",
    textAlign: "center",
  },
  scrollView: {
    width: "100%",
    paddingHorizontal: 10,
  },
  scrollViewContent: {
    alignItems: "center",
    paddingBottom: 20,
  },
  noBackpacksText: {
    fontSize: 16,
    color: "#6c757d",
    marginTop: 50,
  },
  backpackCard: {
    width: "95%",
    backgroundColor: "#ffffff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: 'normal',
    color: '#555',
  },
  backpackStatus: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
    flexShrink: 0,
    textAlign: 'right',
  },
  backpackDescription: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
  },
  dateText: {
    fontSize: 13,
    color: "#777",
    marginBottom: 10,
  },
  inUseCard: {
    backgroundColor: "#fbfffbff",
    borderWidth: 2,
    borderColor: "#aafdaaff"
  },
  lastUsedCard: {
    backgroundColor: "#fbfffbff",
    borderWidth: 2,
    borderColor: "#aafdaaff"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  backpackName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3A3A3A",
    flexShrink: 1
  },
  backpackStatus: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10
  },
});