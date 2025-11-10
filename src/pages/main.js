// main.js

import React, { useEffect, useContext } from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator, ToastAndroid, BackHandler, Alert } from "react-native";
import { delay } from "../utils/validacoes";
import { validarTokens } from "../utils/validacoes";

export default function MainScreen({ navigation }) {

  const mostrarErroFatal = () => {
    Alert.alert(
      "Erro", // Título
      "Erro ao conectar no servidor.\nVerifique sua conexão ou tente novamente mais tarde.", // Mensagem
      [
        {
          text: "OK",
          // A função onPress é o 'callback'
          onPress: () => {
            // O app só fechará APÓS o usuário tocar em "OK"
            BackHandler.exitApp();
          }
        }
      ],
      { cancelable: false } // Garante que o usuário tem que tocar no botão (Android)
    );
  };

  const validarEntrada = async () => {
    try {

      await delay(1000); // Simula loading

      const resposta = await validarTokens(0, navigation);

      if (resposta === 'true') {
        navigation.replace("home");
        return;
      } else if (resposta === 'false') {
        //navigation.replace("login");
        return;
      }else{
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);
      }

    } catch (error) {
      if (error.name === "AbortError") {
        return ToastAndroid.show("Servidor demorou a responder", ToastAndroid.SHORT);
      } else {
        mostrarErroFatal();
      }
    }
  };

  useEffect(() => {
    validarEntrada();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Image
          source={require("../assets/mochila-PI-sem-fundo.png")} // coloque sua imagem aqui
          style={styles.image}
          resizeMode="contain"
        />
        <Text style={styles.title}>MOCHILA{"\n"}INTELIGENTE</Text>
      </View>

      {/* Enquanto valida → loading */}
      {/*}
      <ActivityIndicator size="large" color="#00C200" style={{ marginTop: 20 }} />
      {*/}
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
