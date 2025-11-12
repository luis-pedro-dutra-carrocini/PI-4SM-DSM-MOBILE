// register.js

import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, ToastAndroid } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { validarEmail, validarSenha, diferencaEntreDatas, delay } from "../utils/validacoes";
//import { LINKAPI, PORTAPI } from "@env";
import { LINKAPI, PORTAPI } from "../utils/global";

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [dtNascimento, setDtNascimento] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sexo, setSexo] = useState("");

  const handleConfirmar = async () => {

    const pesoParaAPI = peso.replace(',', '.');
    const alturaParaAPI = altura.replace(',', '.');

    // Nome
    if (!nome || nome.trim() === "") {
      ToastAndroid.show("Nome é obrigatório", ToastAndroid.SHORT);
      return;
    }
    if (nome.trim().length < 3 || nome.trim().length > 100) {
      ToastAndroid.show("Nome deve ter entre 3 e 100 caracteres", ToastAndroid.SHORT);
      return;
    }

    // E-mail
    if (!email) {
      ToastAndroid.show("E-mail é obrigatório", ToastAndroid.SHORT);
      return;
    }
    if (!validarEmail(email)) {
      ToastAndroid.show("E-mail inválido", ToastAndroid.SHORT);
      return;
    }
    if (email.length > 256) {
      ToastAndroid.show("E-mail deve ter no máximo 256 caracteres", ToastAndroid.SHORT);
      return;
    }

    // Senha
    if (!senha) {
      ToastAndroid.show("Senha é obrigatória", ToastAndroid.SHORT);
      return;
    }
    const senhaValidada = validarSenha(senha);
    if (!senhaValidada.valido) {
      ToastAndroid.show(senhaValidada.erro, ToastAndroid.SHORT);
      return;
    }

    // Data de nascimento
    if (!dtNascimento) {
      ToastAndroid.show("Data de nascimento é obrigatória", ToastAndroid.SHORT);
      return;
    }
    const idade = diferencaEntreDatas(dtNascimento, new Date(), "anos", false);
    if (idade < 3) {
      ToastAndroid.show("Usuário deve ter pelo menos 3 anos", ToastAndroid.SHORT);
      return;
    }

    // Peso
    if (!pesoParaAPI) {
      ToastAndroid.show("Peso é obrigatório", ToastAndroid.SHORT);
      return;
    }
    if (Number(pesoParaAPI) < 9) {
      ToastAndroid.show("Peso mínimo para carregar mochila é 9kg", ToastAndroid.SHORT);
      return;
    }

    // Altura
    if (!alturaParaAPI) {
      ToastAndroid.show("Altura é obrigatória", ToastAndroid.SHORT);
      return;
    }
    if (Number(alturaParaAPI) < 0.8) {
      ToastAndroid.show("Altura mínima é 0,80 m", ToastAndroid.SHORT);
      return;
    }

    // Sexo
    if (!sexo) {
      ToastAndroid.show("Selecione o sexo", ToastAndroid.SHORT);
      return;
    }

    try {
      // Timeout 3s
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(LINKAPI + PORTAPI + "/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          UsuarioNome: nome,
          UsuarioEmail: email,
          UsuarioSenha: senha,
          UsuarioDtNascimento: dtNascimento, // já vem como Date do picker
          UsuarioPeso: pesoParaAPI,
          UsuarioAltura: alturaParaAPI,
          UsuarioSexo: sexo,
          UsuarioFoto: null, // opcional por enquanto
          UsuarioPesoMaximoPorcentagem: null // usa padrão do backend (10%)
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json();
        ToastAndroid.show(errorData.error || "Erro ao cadastrar usuário", ToastAndroid.SHORT);
        return;
      }

      const data = await response.json();
      ToastAndroid.show("Cadastro realizado com sucesso!", ToastAndroid.SHORT);
      //console.log("Usuário cadastrado:", data);

      await delay(1000);

      // redireciona para login
      navigation.navigate("login");

    } catch (error) {
      if (error.name === "AbortError") {
        ToastAndroid.show("Servidor demorou a responder", ToastAndroid.SHORT);
      } else {
        ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
      }
    }
  };

  const login = () => {
    navigation.navigate("login");
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
        <Text style={styles.title}>CADASTRAR-SE</Text>

        <TextInput
          style={styles.input}
          placeholder="INFORME SEU NOME"
          placeholderTextColor="#3A3A3A"
          value={nome}
          maxLength={100}
          onChangeText={setNome}
        />

        <TextInput
          style={styles.input}
          placeholder="INFORME SEU E-MAIL"
          placeholderTextColor="#3A3A3A"
          value={email}
          maxLength={256}
          keyboardType="email-address"
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="INFORME SUA SENHA"
          placeholderTextColor="#3A3A3A"
          secureTextEntry
          value={senha}
          maxLength={16}
          onChangeText={setSenha}
        />

        <View style={{ flexDirection: "row" }}>
          <TextInput
            style={styles.input_metade}
            placeholder="PESO (Kg)"
            placeholderTextColor="#3A3A3A"
            value={peso}
            keyboardType="numeric"
            onChangeText={(text) => {
              // Permite dígitos, opcionalmente seguidos por vírgula e até 2 casas decimais.
              const regex = /^\d*\,?\d{0,2}$/; 
              
              // Se o usuário apagar tudo, aceita string vazia.
              if (regex.test(text) || text === "") setPeso(text);
            }}
          />

          <TextInput
            style={styles.input_metade}
            placeholder="ALTURA (m)"
            placeholderTextColor="#3A3A3A"
            value={altura}
            keyboardType="numeric"
            onChangeText={(text) => {
              // Permite dígitos, opcionalmente seguidos por vírgula e até 2 casas decimais.
              const regex = /^\d*\,?\d{0,2}$/;
              
              // Se o usuário apagar tudo, aceita string vazia.
              if (regex.test(text) || text === "") setAltura(text);
            }}
          />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity
            style={[styles.input_metade, { justifyContent: "center" }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ textAlign: "center", color: "#000" }}>
              {dtNascimento.toLocaleDateString("pt-BR")}
            </Text>
          </TouchableOpacity>

          <View style={[styles.input_metade, { padding: 0 }]}>
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

        <TouchableOpacity onPress={login}>
          <Text style={styles.link}>JÁ POSSUI UMA CONTA? ENTRE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eee", justifyContent: "center", alignItems: "center" },
  backButton: { position: "absolute", top: 40, left: 20 },
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
  title: { fontSize: 20, fontWeight: "bold", color: "#FF5C8D", marginBottom: 20 },
  input: {
    width: "100%",
    backgroundColor: "#f7f7f7ff",
    borderColor: "#ecececff",
    borderWidth: 1,
    borderBottomWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    textAlign: "center",
    color: "#000",
  },
  input_metade: {
    backgroundColor: "#f7f7f7ff",
    width: "48%",
    borderColor: "#ecececff",
    borderWidth: 1,
    borderBottomWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    marginLeft: 5,
    marginRight: 5,
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
  buttonText: { fontWeight: "bold", fontSize: 16, color: "#000" },
  link: { fontSize: 13, color: "#3A3A3A", marginTop: 5 },
});
