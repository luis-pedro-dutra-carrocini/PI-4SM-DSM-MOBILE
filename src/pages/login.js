import React, { useState, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ToastAndroid } from "react-native";
import { Ionicons } from "@expo/vector-icons";
//import { LINKAPI, PORTAPI } from "@env";
import { LINKAPI, PORTAPI } from "../utils/global";
import { validarEmail, salvarTokens } from "../utils/validacoes";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const handleLogin = async () => {
    try {
      // Timeout 3s
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      if (!validarEmail(email)) {
        ToastAndroid.show("Estrututura de E-mail inválida", ToastAndroid.SHORT);
        return;
      }

      if (senha.trim().length === 0) {
        ToastAndroid.show("Informe a Senha", ToastAndroid.SHORT);
        return;
      }

      //const link = LINKAPI + PORTAPI + "/usuarios/login";
      //console.log("Fazendo login em:", link);

      const response = await fetch(LINKAPI + PORTAPI + "/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          UsuarioEmail: email,
          UsuarioSenha: senha,
          TipoLogin: "App",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json();
        ToastAndroid.show(errorData.error || "Erro ao fazer login", ToastAndroid.SHORT);
        return;
      }

      const data = await response.json();

      // Salvar tokens no contexto (e SecureStore)
      await salvarTokens(data.accessToken, data.refreshToken);

      //console.log("Access Token:" + data.accessToken + " | Refresh Token:" + data.refreshToken);

      // Depois do login, redireciona
      navigation.navigate("home"); // Ajuste conforme sua rota principal
    } catch (error) {
      if (error.name === "AbortError") {
        ToastAndroid.show("Servidor demorou a responder", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
        //console.error("Erro ao fazer login:", error);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Botão Voltar */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
      >
        <Ionicons name="arrow-back" size={28} color="#3A3A3A" />
      </TouchableOpacity>

      <View style={styles.box}>
        <Text style={styles.title}>LOGIN</Text>

        <TextInput
          style={styles.input}
          placeholder="INFORME SEU E-MAIL"
          placeholderTextColor="#3A3A3A"
          value={email}
          keyboardType="email-address"
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="INFORME SUA SENHA"
          placeholderTextColor="#3A3A3A"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>ENTRAR</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("register")}>
          <Text style={styles.link}>NÃO TEM CONTA? CADASTRE-SE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#e0f7fa",
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
  },
  box: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
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
    marginBottom: 15,
    textAlign: "center",
    color: "#000",
  },
  button: {
    backgroundColor: "#5CFF5C",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginVertical: 15,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#000",
  },
  link: {
    fontSize: 13,
    color: "#3A3A3A",
    marginTop: 5,
  },
});
