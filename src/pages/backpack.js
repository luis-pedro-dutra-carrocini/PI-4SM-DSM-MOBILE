import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ToastAndroid, ScrollView, RefreshControl, ActivityIndicator, Alert, Modal, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import * as CameraModule from "expo-camera";
const Camera = CameraModule.Camera; // <--- GARANTA QUE O COMPONENTE SEJA UM OBJETO DE COMPONENTE VÁLIDO

import { LINKAPI, PORTAPI } from "../utils/global";
import { validarTokens, pegarTokens } from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

export default function BackpackScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const cameraRef = useRef(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedBackpack, setSelectedBackpack] = useState(null);
  const [editedName, setEditedName] = useState("");

  const [backpacks, setBackpacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);

  const [newBackpackName, setNewBackpackName] = useState("");
  const [newBackpackCode, setNewBackpackCode] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const openEditModal = (backpack) => {
    setSelectedBackpack(backpack);
    setEditedName(backpack.MochilaNome);
    setEditModalVisible(true);
  };

  const handleConfirmEdit = async () => {
    if (!editedName.trim()) {
      return ToastAndroid.show("Digite um nome válido", ToastAndroid.SHORT);
    }

    try {
      const resposta = await validarTokens(0, navigation);
      if (resposta !== "true") {
        if (resposta === "false") return;
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);
      }

      const tokens = await pegarTokens();
      const { accessToken } = tokens;

      const response = await fetch(`${LINKAPI}${PORTAPI}/usuarios-mochilas/editarNome`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${String(accessToken)}`,
        },
        body: JSON.stringify({
          MochilaCodigo: selectedBackpack.MochilaCodigo,
          NovoNome: editedName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return ToastAndroid.show(data.error || "Erro ao editar mochila", ToastAndroid.SHORT);
      }

      ToastAndroid.show("Nome da mochila atualizado!", ToastAndroid.SHORT);
      setEditModalVisible(false);
      fetchUserBackpacks();
    } catch (error) {
      console.log(error);
      ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
    }
  };

  const handleUnlinkBackpack = (backpackCode) => {
    Alert.alert(
      "Desvincular Mochila",
      "Deseja realmente desvincular esta mochila?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desvincular",
          style: "destructive",
          onPress: async () => {
            try {
              const resposta = await validarTokens(0, navigation);
              if (resposta !== "true") {
                if (resposta === "false") return;
                return ToastAndroid.show(resposta, ToastAndroid.SHORT);
              }

              const tokens = await pegarTokens();
              const { accessToken } = tokens;

              const response = await fetch(`${LINKAPI}${PORTAPI}/usuarios-mochilas/desvincular`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${String(accessToken)}`,
                },
                body: JSON.stringify({ MochilaCodigo: backpackCode }),
              });

              const data = await response.json();

              if (!response.ok) {
                return ToastAndroid.show(data.error || "Erro ao desvincular mochila", ToastAndroid.SHORT);
              }

              ToastAndroid.show("Mochila desvinculada com sucesso!", ToastAndroid.SHORT);
              fetchUserBackpacks();
            } catch (error) {
              console.log(error);
              ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
            }
          },
        },
      ]
    );
  };

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

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserBackpacks();
  }, [fetchUserBackpacks]);

  const formatDate = (date) => {
    if (!date) return "N/A";
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };
  
  // Função para iniciar o uso de uma mochila
  const handleStartUsing = async (backpackCode) => {
    try {

      const resposta = await validarTokens(0, navigation);

      if (resposta === 'true') {
      } else if (resposta === 'false') {
        return;
      } else {
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);
      }

      let tokens = await pegarTokens();
      let { accessToken, refreshToken } = tokens;

      // Endpoint para iniciar uso da mochila
      const response = await fetch(`${LINKAPI}${PORTAPI}/usuarios-mochilas/assumir/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ MochilaCodigo: backpackCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        ToastAndroid.show(errorData.error || "Erro ao iniciar uso da mochila", ToastAndroid.SHORT);
        return;
      }

      ToastAndroid.show("Iniciado uso da Mochila", ToastAndroid.SHORT);
      fetchUserBackpacks();

    } catch (error) {
      ToastAndroid.show("Erro ao conectar no servidor, tente novamente", ToastAndroid.SHORT);
      await validarTokens(0, navigation);
      return;
    }
  };

  // Função para parar o uso de uma mochila
  const handleStopUsing = async (backpackCode) => {
    try {

      const resposta = await validarTokens(0, navigation);

      if (resposta === 'true') {
      } else if (resposta === 'false') {
        return;
      } else {
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);
      }

      let tokens = await pegarTokens();
      let { accessToken, refreshToken } = tokens;

      // Endpoint para parar uso da mochila
      const response = await fetch(`${LINKAPI}${PORTAPI}/usuarios-mochilas/encerrarUsoApp/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ MochilaCodigo: backpackCode }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        ToastAndroid.show(errorData.error || "Erro ao parar uso da mochila", ToastAndroid.SHORT);
        return;
      }

      ToastAndroid.show("Finalizado uso da Mochila", ToastAndroid.SHORT);
      fetchUserBackpacks();

    } catch (error) {
      ToastAndroid.show("Erro ao conectar no servidor, tente novamente", ToastAndroid.SHORT);
      await validarTokens(0, navigation);
      return;
    }
  };

  // Função para cadastrar nova mochila
  const handleAddBackpack = async () => {
    if (!newBackpackName.trim() || !newBackpackCode.trim()) {
      return ToastAndroid.show("Preencha todos os campos", ToastAndroid.SHORT);
    }

    try {
      const resposta = await validarTokens(0, navigation);
      if (resposta === 'false') return;
      if (resposta !== 'true') return ToastAndroid.show(resposta, ToastAndroid.SHORT);

      let tokens = await pegarTokens();
      let { accessToken } = tokens;

      const response = await fetch(`${LINKAPI}${PORTAPI}/usuarios-mochilas/vincular/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          MochilaNome: newBackpackName,
          MochilaCodigo: newBackpackCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        ToastAndroid.show(errorData.error || "Erro ao cadastrar mochila", ToastAndroid.SHORT);
        return;
      }

      ToastAndroid.show("Mochila vinculada com sucesso!", ToastAndroid.SHORT);
      setNewBackpackName("");
      setNewBackpackCode("");
      fetchUserBackpacks();

    } catch (error) {
      ToastAndroid.show("Erro ao conectar no servidor, tente novamente", ToastAndroid.SHORT);
      await validarTokens(0, navigation);
      return;
    }
  };

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

      <Text style={styles.title}>Minhas Mochilas</Text>


      {/* BOTÃO PARA EXPANDIR/RECOLHER FORMULÁRIO */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setShowAddForm(!showAddForm)}
      >
        <Ionicons
          name={showAddForm ? "chevron-up" : "chevron-down"}
          size={20}
          color="#007bff"
        />
        <Text style={styles.toggleButtonText}>
          {showAddForm ? "Fechar Cadastro de Mochila" : "Cadastrar Nova Mochila"}
        </Text>
      </TouchableOpacity>

      {/* FORMULÁRIO DE CADASTRO (visível só se showAddForm = true) */}
      {showAddForm && (
        <View style={styles.addBackpackContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nome da Mochila"
            value={newBackpackName}
            onChangeText={setNewBackpackName}
          />
          <TextInput
            style={styles.input}
            placeholder="Código da Mochila"
            value={newBackpackCode}
            onChangeText={setNewBackpackCode}
          />

          <TouchableOpacity style={styles.addButton} onPress={handleAddBackpack}>
            <Text style={styles.addButtonText}>CADASTRAR</Text>
          </TouchableOpacity>
          
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {backpacks.length === 0 ? (
          <Text style={styles.noBackpacksText}>Nenhuma mochila vinculada a você.</Text>
        ) : (
          backpacks.map((backpack) => (
            <View
              key={backpack.MochilaCodigo}
              style={[
                styles.backpackCard,
                backpack.UsoStatus === "Usando" ? styles.inUseCard : styles.lastUsedCard,
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.backpackName}>
                  {backpack.MochilaNome}
                </Text>
                <Text
                  style={[
                    styles.backpackStatus,
                    backpack.UsoStatus === "Usando"
                      ? { color: "#28a745" } // Verde para "Usando"
                      : { color: "#6c757d" }, // Cinza para "Último a Usar"
                  ]}
                >
                  {backpack.UsoStatus}
                </Text>
              </View>

              <Text style={styles.statusLabel}>Código: ({backpack.MochilaCodigo})</Text>

              <Text style={styles.backpackDescription}>Descrição: {backpack.MochilaDescricao}</Text>

              <Text style={styles.dateText}>
                {backpack.UsoStatus === "Usando"
                  ? `Data Início: ${formatDate(backpack.DataInicioUso)}`
                  : `Último Uso: ${formatDate(backpack.DataFimUso || backpack.DataInicioUso)}`}
              </Text>

              <View style={styles.buttonContainer}>
                {backpack.UsoStatus === "Usando" ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.stopUsingButton]}
                    onPress={() => handleStopUsing(backpack.MochilaCodigo)}
                  >
                    <Text style={styles.actionButtonText}>Parar de Usar</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.startUsingButton]}
                    onPress={() => handleStartUsing(backpack.MochilaCodigo)}
                  >
                    <Text style={styles.actionButtonText}>Começar a Usar</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.smallButton, { backgroundColor: "#ffc107" }]}
                  onPress={() => openEditModal(backpack)}
                >
                  <Text style={styles.smallButtonText}>Editar Nome</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.smallButton, { backgroundColor: "#6c757d" }]}
                  onPress={() => handleUnlinkBackpack(backpack.MochilaCodigo)}
                >
                  <Text style={styles.smallButtonText}>Desvincular</Text>
                </TouchableOpacity>
              </View>


            </View>
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

      {/* MODAL PARA EDITAR NOME DA MOCHILA */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Editar Nome da Mochila</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Novo nome"
              value={editedName}
              onChangeText={setEditedName}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#6c757d" }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#007bff" }]}
                onPress={handleConfirmEdit}
              >
                <Text style={styles.modalButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    backgroundColor: "#e0f7fa",
    paddingTop: 50,
  },
  loadingContainer: {
    justifyContent: 'center',
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 1,
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
  inUseCard: {
    backgroundColor: "#d4edda", 
    borderWidth: 2,
    borderColor: "#28a745", 
  },
  lastUsedCard: {
    backgroundColor: "#e2e3e5", 
    borderWidth: 1,
    borderColor: "#adb5bd", 
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  backpackName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3A3A3A",
    flexShrink: 1, 
    marginRight: 10,
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
  buttonContainer: {
    marginTop: 10,
  },
  actionButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  startUsingButton: {
    backgroundColor: "#007bff", 
  },
  stopUsingButton: {
    backgroundColor: "#dc3545", 
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  navBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#3A3A3A",
    paddingVertical: 15,
    alignItems: "center",
  },
  navBarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },


  // NOVOS ESTILOS
  addBackpackContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  addButton: {
    backgroundColor: "#5CFF5C",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: { color: "#000", fontWeight: "bold", fontSize: 16 },

  scrollView: { width: "100%", paddingHorizontal: 10 },
  scrollViewContent: { alignItems: "center", paddingBottom: 20 },
  noBackpacksText: { fontSize: 16, color: "#6c757d", marginTop: 50 },

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
  inUseCard: { backgroundColor: "#d4edda", borderWidth: 2, borderColor: "#28a745" },
  lastUsedCard: { backgroundColor: "#e2e3e5", borderWidth: 1, borderColor: "#adb5bd" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  backpackName: { fontSize: 18, fontWeight: "bold", color: "#3A3A3A", flexShrink: 1 },
  backpackStatus: { fontSize: 16, fontWeight: "bold", marginLeft: 10 },
  statusLabel: { fontSize: 14, marginBottom: 8, color: "#555" },
  backpackDescription: { fontSize: 14, color: "#555", marginBottom: 8 },
  dateText: { fontSize: 13, color: "#777", marginBottom: 10 },

  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#007bff",
  },
  toggleButtonText: {
    color: "#007bff",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 8,
  },

  // Editar Moochila e Desvincular
  smallButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  smallButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },

  // --- Modal de Edição ---
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

});