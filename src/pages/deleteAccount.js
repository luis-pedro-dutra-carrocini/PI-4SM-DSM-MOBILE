// deleteAccount.js

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ToastAndroid,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";

import { limparTokens, pegarTokens } from "../utils/validacoes";
import { LINKAPI, PORTAPI } from "../utils/global";

export default function DeleteAccountScreen({ navigation }) {
  const route = useRoute();
  // O e-mail do usuário pode ser útil na tela, mesmo que não seja usado na exclusão
  const { userEmail } = route.params || { userEmail: '' };

  const [senhaExclusao, setSenhaExclusao] = useState("");
  const senhaExclusaoRef = useRef(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // EFEITO para focar o input automaticamente (MAIS ESTÁVEL AGORA)
  useEffect(() => {
    let timer;
    let showSubscription;

    // Foco automático ao carregar a tela
    if (Platform.OS === 'ios') {
        timer = setTimeout(() => senhaExclusaoRef.current?.focus(), 100);
    } else {
        // No Android, ainda é mais seguro usar o listener,
        // mas aqui é menos propenso a loop do que dentro de um Modal
        showSubscription = Keyboard.addListener('keyboardDidShow', () => {
            senhaExclusaoRef.current?.focus();
            showSubscription.remove();
        });
        timer = setTimeout(() => senhaExclusaoRef.current?.focus(), 500);
    }
    
    return () => {
        clearTimeout(timer);
        if (showSubscription) showSubscription.remove();
    };
  }, []);

  // FUNÇÃO DE EXCLUSÃO FINAL
  const handleExcluirContaFinal = async () => {
    if (isDeleting) return;

    if (!senhaExclusao || senhaExclusao.trim() === "") {
      ToastAndroid.show(
        "Para exclusão informe a senha atual",
        ToastAndroid.SHORT
      );
      senhaExclusaoRef.current?.focus();
      return;
    }

    setIsDeleting(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      let tokens = await pegarTokens();
      let { accessToken } = tokens;

      const response = await fetch(LINKAPI + PORTAPI + "/usuarios", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ UsuarioSenha: senhaExclusao }),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      setSenhaExclusao(""); 
      setIsDeleting(false);

      if (!response.ok) {
        const errorData = await response.json();
        ToastAndroid.show(
          errorData.error || "Erro ao excluir conta. Senha incorreta?",
          ToastAndroid.LONG
        );
        return;
      }

      await limparTokens();
      // Navega para a tela de Login e limpa o histórico
      navigation.reset({
        index: 0,
        routes: [{ name: "login" }],
      });
      ToastAndroid.show("Conta excluída com sucesso!", ToastAndroid.SHORT);
    } catch (error) {
      setIsDeleting(false);
      ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
      console.log(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.contentBox}>
          <Text style={styles.title}>Confirmação de Exclusão</Text>
          <Text style={styles.description}>
            Esta ação é Irreversível. {'\n'}
            E-mail: <Text style={styles.emailText}>{userEmail || 'Não Informado'}</Text>{"\n"} 
            Por favor, digite sua Senha Atual.
          </Text>

          <TextInput
            style={styles.input}
            ref={senhaExclusaoRef} 
            placeholder="Digite sua Senha Atual"
            placeholderTextColor="#888"
            secureTextEntry
            value={senhaExclusao}
            maxLength={16}
            onChangeText={setSenhaExclusao}
            returnKeyType="done"
            onSubmitEditing={handleExcluirContaFinal} 
            editable={!isDeleting}
          />
          
          {isDeleting && <Text style={styles.loadingText}>Excluindo conta...</Text>}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={() => navigation.goBack()}
              disabled={isDeleting}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonConfirm]}
              onPress={handleExcluirContaFinal}
              disabled={isDeleting}
            >
              <Text style={styles.buttonTextConfirm}>
                {isDeleting ? "Aguarde..." : "Excluir"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eee',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    width: "85%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#D32F2F", // Vermelho
    marginBottom: 20,
  },
  description: {
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
    fontSize: 15,
  },
  emailText: {
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  input: {
    backgroundColor: "#f0f0f0",
    width: "100%",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    textAlign: "center",
    color: "#000",
    borderWidth: 1,
    borderColor: "#ccc",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    elevation: 2,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  buttonCancel: {
    backgroundColor: "#ccc",
  },
  buttonConfirm: {
    backgroundColor: "#D32F2F", // Vermelho forte
  },
  buttonText: {
    color: "black",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 14,
  },
  buttonTextConfirm: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 14,
  },
  loadingText: {
    color: '#D32F2F',
    marginBottom: 10,
    fontWeight: 'bold',
  }
});