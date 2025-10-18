import React, { use, useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, BackHandler, ToastAndroid, Alert, ActivityIndicator } from "react-native";

import * as Progress from "react-native-progress";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

import { pegarTokens, salvarTokens, limparTokens, roundTo2, delay, obterDadosUsuario } from "../utils/validacoes";
import { LINKAPI, PORTAPI } from "../utils/global";
import { solicitarPermissaoNotificacao, enviarNotificacao } from "../utils/notificacoes";


export default function HomeScreen({ navigation }) {

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);

  const [loading, setLoading] = useState(true);

  const imagensMochilas = {
    'mochilaSolo': require("../assets/mochila-solo.png"),
    'mochileira': require("../assets/mochileira-sem-bone.png"),
    'mochileiro': require("../assets/mochileiro.png"),
  };

  const [nomePessoa, setNomePessoa] = useState("");
  const [pessoa, setPessoa] = useState("mochilaSolo");
  const [pesoMaximo, setPesoMaximo] = useState(1);
  const [pesoEsquerdo, setPesoEsquerdo] = useState(1);
  const [pesoDireito, setPesoDireito] = useState(1);
  const [dataUltimaAtualizacao, setDataUltimaAtualizacao] = useState(new Date());
  const [pesoTotal, setPesoTotal] = useState(1);
  const [percEsquerdo, setPercEsquerdo] = useState(1);
  const [percDireito, setPercDireito] = useState(1);
  const [temMochila, setTemMochila] = useState(true);
  const [mostrarTela, setMostrarTela] = useState(false);
  const [corTextoCirculo, setCorTextoCirculo] = useState('');

  useEffect(() => {
    solicitarPermissaoNotificacao();
  }, []);

  const [notificacaoEnviada, setNotificacaoEnviada] = useState(false);

  useEffect(() => {
    if (Number(pesoTotal) > Number(pesoMaximo) && !notificacaoEnviada) {
      enviarNotificacao(
        "Atenção!",
        "O peso carregado excede o limite permitido da sua mochila!"
      );
      setNotificacaoEnviada(true);
    } else if (Number(pesoTotal) <= Number(pesoMaximo) && notificacaoEnviada) {
      setNotificacaoEnviada(false); // reseta quando voltar ao normal
    }
  }, [pesoTotal, pesoMaximo]);


  const TEMPO_ATUALIZACAO_MS = 20000;
  useEffect(() => {

    bucarDados();

    // Configura o intervalo para rodar periodicamente
    const intervalId = setInterval(() => {
      // console.log("Atualizando dados..." + new Date());
      bucarDados();
    }, TEMPO_ATUALIZACAO_MS);

    const backAction = () => {
      BackHandler.exitApp()
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    //Função de Limpeza (Cleanup)
    return () => {
      // Limpa o listener do botão de voltar
      backHandler.remove();

      // LIMPA O INTERVALO quando o componente for desmontado
      clearInterval(intervalId);
    };
  }, [navigation]);

  const bucarDados = async () => {
    try {

      setDataUltimaAtualizacao(new Date());

      /*
      let tokens = await pegarTokens();
      let { accessToken, refreshToken } = tokens;

      if (!accessToken || !refreshToken) {
        console.log("Tokens ausentes");
        await limparTokens();
        navigation.reset({
          index: 0,
          routes: [{ name: "login" }],
        });
        return;
      }

      // 1. Valida accessToken
      let response = await fetch(LINKAPI + PORTAPI + "/usuarios/id", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          signal: controller.signal,
        },
      });

      clearTimeout(timeout);

      let data;

      if (!response.ok) {

        // 2. Se expirado, tenta refresh
        response = await fetch(LINKAPI + PORTAPI + "/token/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "Bearer " + refreshToken }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) {
          data = await response.json();
          await salvarTokens(data.accessToken, refreshToken);
          console.log("Access Token: " + data.accessToken);
          console.log("Refresh Token: " + refreshToken);
          response = await fetch(LINKAPI + PORTAPI + "/usuarios/id", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${String(data.accessToken)}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (!response.ok) {
            console.log("Falha ao obter dados do usuário");
            const errorData = await response.json();
            ToastAndroid.show(errorData.error || "Falha ao obter dados do usuário", ToastAndroid.SHORT);
            await limparTokens();
            navigation.reset({
              index: 0,
              routes: [{ name: "login" }],
            });
            return;
          }

        } else {
          console.log("Falha ao renovar token");
          const errorData = await response.json();
          ToastAndroid.show(errorData.error || "Falha ao renovar acesso", ToastAndroid.SHORT);
          await limparTokens();
          navigation.reset({
            index: 0,
            routes: [{ name: "login" }],
          });
          return;
        }
      }

      tokens = await pegarTokens();

      accessToken = tokens.accessToken;

      data = await response.json();

      //console.log("Dados do usuário:", data);
      */

      const data = await obterDadosUsuario(navigation);

      if (data === 'false') {
        return;
      }

      let tokens = await pegarTokens();
      let { accessToken, refreshToken } = tokens;

      if (data.usuario.UsuarioPeso) {
        setPesoMaximo(data.usuario.UsuarioPeso * (data.usuario.UsuarioPesoMaximoPorcentagem / 100));
      }

      if (data.usuario.UsuarioNome) {
        // 1. Pega o nome completo
        const nomeCompleto = data.usuario.UsuarioNome;

        // 2. Divide em um array e pega o primeiro elemento
        const primeiroNome = nomeCompleto.split(' ')[0];

        // 3. Atualiza o estado com apenas o primeiro nome
        setNomePessoa(primeiroNome);
      }

      if (data.usuario.UsuarioSexo === "Feminino") {
        setPessoa("mochileira");
      } else if (data.usuario.UsuarioSexo === "Masculino") {
        setPessoa("mochileiro");
      }

      // Timeout 3s
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const responseMochila = await fetch(LINKAPI + PORTAPI + "/usuarios-mochilas/mochilaUso", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${String(accessToken)}`,
          signal: controller.signal,
        },
      });

      clearTimeout(timeout);

      if (!responseMochila.ok) {
        setTemMochila(false);
        return;
      }

      const dataMochila = await responseMochila.json();

      if (dataMochila.mochila.MochilaCodigo) {
        const medicoesMochila = await fetch(LINKAPI + PORTAPI + "/medicoes/atual/" + dataMochila.mochila.MochilaCodigo, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${String(accessToken)}`,
            signal: controller.signal,
          },
        });

        clearTimeout(timeout);

        if (!medicoesMochila.ok) {
          console.log("Falha ao obter medições");
          const errorData = await response.json();
          console.log(errorData)
          return;
        }

        const dataMedicao = await medicoesMochila.json();
        console.log(dataMedicao);

        let pesoTotalConta;
        if (!dataMedicao.esquerda || !dataMedicao.direita) {
          setPesoTotal(0);
          pesoTotalConta = 0;
          setPesoEsquerdo(0);
          setPercEsquerdo(0);
          setPesoDireito(0);
          setPercDireito(0);
          return;
        } else {
          setPesoTotal(roundTo2(Number(dataMedicao.esquerda.MedicaoPeso) + Number(dataMedicao.direita.MedicaoPeso)));
          pesoTotalConta = roundTo2(Number(dataMedicao.esquerda.MedicaoPeso) + Number(dataMedicao.direita.MedicaoPeso));
        }

        setTemMochila(true);

        if (dataMedicao.esquerda) {
          setPesoEsquerdo(Number(dataMedicao.esquerda.MedicaoPeso));
          setPercEsquerdo(Number(dataMedicao.esquerda.MedicaoPeso) / Number(pesoTotalConta));
        } else {
          setPesoEsquerdo(0);
          setPercEsquerdo(0);
        }

        if (dataMedicao.direita) {
          setPesoDireito(Number(dataMedicao.direita.MedicaoPeso));
          setPercDireito(Number(dataMedicao.direita.MedicaoPeso) / Number(pesoTotalConta));
        } else {
          setPesoDireito(0);
          setPercDireito(0);
        }

        if (((Number(pesoTotalConta) / Number(pesoMaximo)) * 100) > 50) {
          setCorTextoCirculo('#bd1c11ff');
        } else {
          setCorTextoCirculo('#338136ff');
        }

      } else {
        setTemMochila(false);
      }

    } catch (error) {
      if (error.name === "AbortError") {
        ToastAndroid.show("Servidor demorou a responder", ToastAndroid.SHORT);
      } else {
        //ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
        //Alert.alert('Erro', 'Erro ao conectar no servidor. \nVerifique sua conexão ou tente novamente mais tarde.')
        console.log(error);
        navigation.reset({
          index: 0,
          routes: [{ name: "main" }],
        });
        return;
      }
    } finally {
      setLoading(false);
      setMostrarTela(true);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10, alignItems: "center", textAlign: "center" }}>Carregando dados...</Text>
      </View>
    );
  }

  return mostrarTela ? (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Parte de cima com imagem */}
        <View style={styles.topContainer}>
          <Text style={{ color: "#000", fontWeight: "600", fontSize: 18, marginBottom: 30, textAlign: "center" }}>
            Olá, {nomePessoa}! {"\n"}Peso em Tempo Real
          </Text>
          <Image
            source={imagensMochilas[pessoa]}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Indicador circular */}
        {temMochila ? (
          <View style={styles.middleContainer}>
            <Progress.Circle
              style={styles.circleWrapper}
              size={170}
              thickness={20}
              progress={Number(pesoTotal) / Number(pesoMaximo)}
              showsText={true}
              color={"#bd1c11ff"}
              unfilledColor={"#338136ff"}
              borderWidth={0}
              formatText={() =>
                ` ${Math.round((Number(pesoTotal) / Number(pesoMaximo)) * 100)}%\n${Number(pesoTotal)} Kg`
              }
              textStyle={{
                fontSize: 22,
                textAlign: "center",
                fontWeight: "bold",
                color: corTextoCirculo,
              }}
            />

            {/* Barra personalizada para comparação */}
            <View style={styles.barraContainer}>
              <View style={[styles.barraEsquerda, { flex: percEsquerdo }]} />
              <View style={[styles.barraDireita, { flex: percDireito }]} />
            </View>

            {/* Labels */}
            <View style={styles.labels}>
              <Text style={{ color: "#F46334", fontWeight: "600" }}>
                Esquerdo: {Math.round(Number(percEsquerdo) * 100)}% ({Number(pesoEsquerdo)} Kg)
              </Text>
              <Text style={{ color: "#36985B", fontWeight: "600" }}>
                Direito: {Math.round(Number(percDireito) * 100)}% ({Number(pesoDireito)} Kg)
              </Text>
            </View>

            <Text style={{ color: "#00000", fontWeight: "600", fontSize: 13, marginTop: 10 }}>
              Atualizado {dataUltimaAtualizacao.toLocaleString()}
            </Text>

          </View>
        ) : (
          <Text style={{ marginTop: 30, fontSize: 16, color: "gray", textAlign: "center", fontWeight: "600" }}>
            Nenhuma mochila em uso{"\n\n"}Selecione uma para começar
          </Text>
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
  ) : (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

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
    paddingTop: 50,
    flex: 1,
    backgroundColor: "#e0f7fa",
  },
  scrollContainer: {
    alignItems: "center",
    paddingBottom: 20,
  },
  topContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  image: {
    width: 250,
    height: 250,
  },
  middleContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
    width: "100%",
  },
  circleWrapper: {
    marginBottom: 10,
    textAlign: "center",
  },
  barraContainer: {
    flexDirection: "row",
    width: "90%",
    height: 25,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 20,
  },
  barraEsquerda: {
    backgroundColor: "#F46334",
  },
  barraDireita: {
    backgroundColor: "#36985B",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "90%",
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
