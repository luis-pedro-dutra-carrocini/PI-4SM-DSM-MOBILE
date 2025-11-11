// main.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator, ToastAndroid, BackHandler, Alert } from "react-native";
import { delay } from "../utils/validacoes";
import { validarTokens, obterDadosUsuario } from "../utils/validacoes";

export default function MainScreen({ navigation }) {
  const [carregando, setCarregando] = useState(true);

  const mostrarErroFatal = (mensagem = "Erro ao conectar no servidor.\nVerifique sua conexão ou tente novamente mais tarde.") => {
    Alert.alert(
      "Erro",
      mensagem,
      [
        {
          text: "OK",
          onPress: () => BackHandler.exitApp()
        }
      ],
      { cancelable: false }
    );
  };

  // main.js - Atualize a função validarEntrada
  // main.js - Adicione mais logs para debug
  const validarEntrada = async () => {
    try {
      setCarregando(true);
      await delay(1000);

      console.log("🔐 Iniciando validação de tokens...");
      const respostaValidacao = await validarTokens(0, navigation);

      console.log("📋 Resposta da validação:", respostaValidacao);

      if (respostaValidacao === 'true') {
        console.log("✅ Tokens válidos, obtendo dados do usuário...");

        const dadosUsuario = await obterDadosUsuario(navigation);
        console.log("📦 Dados recebidos:", dadosUsuario);

        if (typeof dadosUsuario === 'object') {
          if (dadosUsuario.ok === true && dadosUsuario.usuario) {
            console.log("✅ Dados obtidos com sucesso, navegando para home...");
            navigation.replace("home", { usuario: dadosUsuario.usuario });
          }
          else if (dadosUsuario.UsuarioPeso || dadosUsuario.UsuarioNome) {
            console.log("✅ Dados obtidos com sucesso (formato direto), navegando para home...");
            navigation.replace("home", { usuario: dadosUsuario });
          }
          else {
            console.log("❌ Estrutura de dados inválida:", dadosUsuario);
            mostrarErroFatal("Erro inesperado ao carregar dados.");
          }
        } else if (dadosUsuario === 'endpoint_nao_encontrado') {
          console.log("⚠️ Endpoint não encontrado, mas tokens válidos - navegando para home");
          navigation.replace("home");
        } else {
          console.log("❌ Não foi possível obter dados do usuário:", dadosUsuario);
          mostrarErroFatal("Erro ao carregar dados do usuário.");
        }
      } else if (respostaValidacao === 'false') {
        console.log("❌ Tokens inválidos, navegando para login...");
        navigation.replace("login");
      } else {
        console.log("🌐 Problema de conexão:", respostaValidacao);
        mostrarErroFatal();
      }

    } catch (error) {
      console.error("💥 Erro fatal na validação:", error);
      mostrarErroFatal();
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    validarEntrada();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Image
          source={require("../assets/mochila-PI-sem-fundo.png")}
          style={styles.image}
          resizeMode="contain"
        />
        <Text style={styles.title}>MOCHILA{"\n"}INTELIGENTE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#b6f5e7ff",
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  image: {
    width: 180,
    height: 180,
    marginBottom: 5,
  },
  title: {
    fontSize: 23,
    fontWeight: "bold",
    textAlign: "center",
    color: "#00C200",
  },
});
