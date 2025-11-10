// profile.js

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ToastAndroid,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import {
  validarEmail,
  validarSenha,
  diferencaEntreDatas,
  delay,
  pegarTokens,
  salvarTokens,
  limparTokens,
  obterDadosUsuario,
} from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";
import { LINKAPI, PORTAPI } from "../utils/global";

export default function ProfileScreen({ navigation }) {
  const senhaAlteracaoRef = useRef(null);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);

  // NOVO STATE PARA O MODAL DE EXCLUSÃO
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState(""); // Senha para alteração (opcional)
  const [nome, setNome] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [pesoMaxPor, setPesoMaxPor] = useState("");
  const [dtNascimento, setDtNascimento] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sexo, setSexo] = useState("");

  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [mostrarTela, setMostrarTela] = useState(false);

  useEffect(() => {
    bucarDados();

    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const bucarDados = async () => {
    try {
      const response = await obterDadosUsuario(navigation);
      if (response === "false") return;

      const pesoFor = response.usuario.UsuarioPeso?.replace(".", ",") ?? "";
      const alturaFor = response.usuario.UsuarioAltura?.replace(".", ",") ?? "";

      setAltura(alturaFor);
      setPeso(pesoFor);
      setDtNascimento(new Date(response.usuario.UsuarioDtNascimento));
      setEmail(response.usuario.UsuarioEmail ?? "");
      setNome(response.usuario.UsuarioNome ?? "");
      setSexo(response.usuario.UsuarioSexo ?? "");
      setPesoMaxPor(response.usuario.UsuarioPesoMaximoPorcentagem ?? "");
    } catch (error) {
      if (error.name === "AbortError") {
        ToastAndroid.show("Servidor demorou a responder", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
        console.log(error);
        navigation.reset({
          index: 0,
          routes: [{ name: "main" }],
        });
      }
    } finally {
      setLoading(false);
      setMostrarTela(true);
    }
  };

  const handleConfirmar = async () => {
    const pesoParaAPI = peso.replace(",", ".");
    const alturaParaAPI = altura.replace(",", ".");

    let tokens = await pegarTokens();
    let { accessToken } = tokens;

    if (!nome || nome.trim() === "")
      return ToastAndroid.show("Nome é obrigatório", ToastAndroid.SHORT);
    if (!validarEmail(email))
      return ToastAndroid.show("E-mail inválido", ToastAndroid.SHORT);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(LINKAPI + PORTAPI + "/usuarios", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          UsuarioNome: nome,
          UsuarioEmail: email,
          UsuarioSenha: senha,
          UsuarioDtNascimento: dtNascimento,
          UsuarioPeso: pesoParaAPI,
          UsuarioAltura: alturaParaAPI,
          UsuarioSexo: sexo,
          UsuarioFoto: null,
          UsuarioPesoMaximoPorcentagem: pesoMaxPor
            ? pesoMaxPor.replace(",", ".")
            : null,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json();
        ToastAndroid.show(
          errorData.error || "Erro ao alterar os dados",
          ToastAndroid.SHORT
        );
        return;
      }

      ToastAndroid.show("Dados alterados com sucesso!", ToastAndroid.SHORT);
      setSenha("");
    } catch (error) {
      if (error.name === "AbortError") {
        ToastAndroid.show("Servidor demorou a responder", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
      }
    }
  };

  const handleAbrirModalExclusao = () => {
    navigation.navigate("deleteAccount", { userEmail: email });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text
          style={{ marginTop: 10, alignItems: "center", textAlign: "center" }}
        >
          Carregando dados...
        </Text>
      </View>
    );
  }

  return mostrarTela ? (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Ajuste do KeyboardAvoidingView: 'height' no Android, 'padding' no iOS, com offset */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        {/* TouchableWithoutFeedback fecha o teclado ao tocar fora */}
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <KeyboardAwareScrollView
            enableOnAndroid={!deleteModalVisible}
            scrollEnabled={!deleteModalVisible}
            keyboardOpeningTime={0}
            extraScrollHeight={Platform.OS === "android" ? 120 : 40}
            enableAutomaticScroll={true}
            keyboardShouldPersistTaps="handled"
            resetScrollToCoords={{ x: 0, y: 0 }}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.box}>
              <Text style={styles.title}>MEU PERFIL</Text>

              <TextInput
                style={styles.input}
                placeholder="INFORME SEU NOME"
                placeholderTextColor="#3A3A3A"
                value={nome}
                maxLength={100}
                onChangeText={setNome}
                returnKeyType="next"
              />

              <TextInput
                style={styles.input}
                placeholder="INFORME SEU E-MAIL"
                placeholderTextColor="#3A3A3A"
                value={email}
                maxLength={256}
                keyboardType="email-address"
                onChangeText={setEmail}
                returnKeyType="next"
              />

              <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-between" }}>
                <TextInput
                  style={[styles.input_metade, { width: "48%" }]}
                  placeholder="PESO (Kg)"
                  placeholderTextColor="#3A3A3A"
                  value={peso}
                  keyboardType="numeric"
                  onChangeText={(text) => {
                    const regex = /^\d*\,?\d{0,2}$/;
                    if (regex.test(text) || text === "") setPeso(text);
                  }}
                  returnKeyType="next"
                />

                <TextInput
                  style={[styles.input_metade, { width: "48%" }]}
                  placeholder="ALTURA (m)"
                  placeholderTextColor="#3A3A3A"
                  value={altura}
                  keyboardType="numeric"
                  onChangeText={(text) => {
                    const regex = /^\d*\,?\d{0,2}$/;
                    if (regex.test(text) || text === "") setAltura(text);
                  }}
                  returnKeyType="next"
                />
              </View>

              <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-between" }}>
                <TextInput
                  style={[styles.input_metade, { width: "48%" }]}
                  placeholder="Peso Máx. (%)"
                  placeholderTextColor="#3A3A3A"
                  value={pesoMaxPor}
                  keyboardType="numeric"
                  onChangeText={(text) => {
                    const regex = /^\d*\,?\d{0,2}$/;
                    if (regex.test(text) || text === "") setPesoMaxPor(text);
                  }}
                  returnKeyType="next"
                />

                <TouchableOpacity
                  style={[styles.input_metade, { width: "48%", justifyContent: "center" }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ textAlign: "center", color: "#000" }}>
                    {dtNascimento.toLocaleDateString("pt-BR")}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ width: "100%", marginBottom: 12 }}>
                <View style={[styles.input, { padding: 0 }]}>
                  <Picker
                    selectedValue={sexo}
                    style={{ height: 50, width: "100%" }}
                    onValueChange={(itemValue) => setSexo(itemValue)}
                  >
                    <Picker.Item label="Sexo" value="" />
                    <Picker.Item label="Masculino" value="Masculino" />
                    <Picker.Item label="Feminino" value="Feminino" />
                    <Picker.Item label="Outro" value="Outro" />
                    <Picker.Item label="Prefiro não dizer" value="Prefiro não dizer" />
                  </Picker>
                </View>
              </View>

              <TextInput
                style={styles.input}
                ref={senhaAlteracaoRef}
                placeholder="NOVA SENHA (Opcional)"
                placeholderTextColor="#3A3A3A"
                secureTextEntry
                value={senha}
                maxLength={16}
                onChangeText={setSenha}
                returnKeyType="done"
              />

              {showDatePicker && (
                <DateTimePicker
                  value={dtNascimento}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) setDtNascimento(selectedDate);
                  }}
                />
              )}

              <TouchableOpacity style={styles.button} onPress={handleConfirmar}>
                <Text style={styles.buttonText}>CONFIRMAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonDanger}
                onPress={handleAbrirModalExclusao}
              >
                <Text style={styles.buttonTextDanger}>EXCLUIR CONTA</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Barra inferior fora do ScrollView */}
      {!keyboardVisible && !deleteModalVisible && (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
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

          <BottomNav navigation={navigation} onOpenSettings={() => setSettingsVisible(true)} />
        </View>
      )}
    </SafeAreaView>
  ) : (
    <View style={styles.container}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
    flex: 1,
    backgroundColor: "#eee",
  },
  scrollContentContainer: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: 30,
    paddingTop: 10,
  },
  box: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "90%", // ligeiro aumento para comportamento responsivo
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    marginVertical: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF5C8D",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#9FFBF7",
    width: "100%",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    textAlign: "center",
    color: "#000",
  },
  input_metade: {
    backgroundColor: "#9FFBF7",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    textAlign: "center",
    color: "#000",
  },
  button: {
    backgroundColor: "#5CFF5C",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 15,
    width: "100%",
    alignItems: "center",
    borderColor: "#5CFF5C",
    borderWidth: 2,
  },
  buttonDanger: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 1,
    width: "100%",
    alignItems: "center",
    borderColor: "red",
    borderWidth: 2,
  },
  buttonText: { fontWeight: "bold", fontSize: 16, color: "#000" },
  buttonTextDanger: { fontWeight: "bold", fontSize: 16, color: "red" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
