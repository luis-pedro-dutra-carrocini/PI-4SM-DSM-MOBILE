// home.js
import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, Image, ScrollView, BackHandler, ToastAndroid, Alert, ActivityIndicator } from "react-native";
import * as Progress from "react-native-progress";
import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";
import { pegarTokens, roundTo2, obterDadosUsuario } from "../utils/validacoes";
import { LINKAPI, PORTAPI } from "../utils/global";

export default function HomeScreen({ navigation, route }) {
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erroConexao, setErroConexao] = useState(false);

  // Dados do usuário
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

  const intervalRef = useRef(null);
  const tentativasRef = useRef(0);

  const imagensMochilas = {
    'mochilaSolo': require("../assets/mochila-solo.png"),
    'mochileira': require("../assets/mochileira-sem-bone.png"),
    'mochileiro': require("../assets/mochileiro.png"),
  };

  // home.js - Atualize a parte que processa os dados do usuário
  const bucarDados = async () => {
    try {
      console.log("🔄 Buscando dados da home...");
      tentativasRef.current++;

      if (tentativasRef.current > 3) {
        console.log("🚫 Muitas tentativas falhas, parando...");
        setErroConexao(true);
        setLoading(false);
        setMostrarTela(true);
        return;
      }

      setDataUltimaAtualizacao(new Date());

      // 🔄 Obtém dados do usuário
      const dataResponse = await obterDadosUsuario(navigation);

      if (dataResponse === 'false' || dataResponse === 'offline') {
        console.log("❌ Problema com tokens ou conexão");
        if (dataResponse === 'false') {
          navigation.reset({
            index: 0,
            routes: [{ name: "login" }],
          });
        } else {
          setErroConexao(true);
        }
        setLoading(false);
        setMostrarTela(true);
        return;
      }

      // ✅ CORREÇÃO: Extrai os dados do usuário da resposta
      let data;
      if (dataResponse.ok === true && dataResponse.usuario) {
        data = dataResponse.usuario; // Extrai do objeto {ok: true, usuario: {...}}
      } else {
        data = dataResponse; // Já é o objeto do usuário diretamente
      }

      tentativasRef.current = 0;
      setErroConexao(false);

      // Processa dados do usuário (agora usando a variável `data` corretamente)
      if (data.UsuarioPeso) {
        setPesoMaximo(data.UsuarioPeso * (data.UsuarioPesoMaximoPorcentagem / 100));
      }

      if (data.UsuarioNome) {
        const nomeCompleto = data.UsuarioNome;
        const primeiroNome = nomeCompleto.split(' ')[0];
        setNomePessoa(primeiroNome);
      }

      if (data.UsuarioSexo === "Feminino") {
        setPessoa("mochileira");
      } else if (data.UsuarioSexo === "Masculino") {
        setPessoa("mochileiro");
      }

      // 🔄 Busca dados da mochila
      const tokens = await pegarTokens();
      const { accessToken } = tokens;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        const responseMochila = await fetch(LINKAPI + PORTAPI + "/usuarios-mochilas/mochilaUso", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!responseMochila.ok) {
          setTemMochila(false);
          return;
        }

        const dataMochila = await responseMochila.json();

        if (dataMochila.mochila?.MochilaCodigo) {
          // Busca medições da mochila
          const medicoesResponse = await fetch(LINKAPI + PORTAPI + "/medicoes/atual/" + dataMochila.mochila.MochilaCodigo, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (medicoesResponse.ok) {
            const dataMedicao = await medicoesResponse.json();
            console.log("📊 Dados da medição:", dataMedicao);

            let pesoTotalConta = 0;

            if (dataMedicao.esquerda && dataMedicao.direita) {
              pesoTotalConta = roundTo2(Number(dataMedicao.esquerda.MedicaoPeso) + Number(dataMedicao.direita.MedicaoPeso));
              setPesoTotal(pesoTotalConta);
              setPesoEsquerdo(Number(dataMedicao.esquerda.MedicaoPeso));
              setPesoDireito(Number(dataMedicao.direita.MedicaoPeso));
              setPercEsquerdo(Number(dataMedicao.esquerda.MedicaoPeso) / pesoTotalConta);
              setPercDireito(Number(dataMedicao.direita.MedicaoPeso) / pesoTotalConta);
            } else {
              setPesoTotal(0);
              setPesoEsquerdo(0);
              setPesoDireito(0);
              setPercEsquerdo(0);
              setPercDireito(0);
            }

            setTemMochila(true);

            // Define cor do círculo baseado no peso
            if (pesoTotalConta > 0 && ((pesoTotalConta / pesoMaximo) * 100) > 50) {
              setCorTextoCirculo('#bd1c11ff');
            } else {
              setCorTextoCirculo('#338136ff');
            }
          }
        } else {
          setTemMochila(false);
        }
      } catch (error) {
        if (error.name === "AbortError") {
          console.log("⏰ Timeout ao buscar dados da mochila");
        } else {
          console.log("💥 Erro ao buscar dados da mochila:", error);
        }
        setTemMochila(false);
      }

    } catch (error) {
      console.log("💥 Erro geral na busca de dados:", error);
      setErroConexao(true);
    } finally {
      setLoading(false);
      setMostrarTela(true);
    }
  };

  useEffect(() => {
    // Busca dados inicial
    bucarDados();

    // Configura intervalo para atualizações periódicas
    intervalRef.current = setInterval(() => {
      if (!erroConexao) { // Só atualiza se não estiver em estado de erro
        bucarDados();
      }
    }, 20000);

    // Configura botão voltar
    const backAction = () => {
      BackHandler.exitApp();
      return true;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    // Cleanup
    return () => {
      backHandler.remove();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // 🔄 Tenta reconectar quando erro de conexão
  const tentarReconectar = () => {
    setErroConexao(false);
    setLoading(true);
    tentativasRef.current = 0;
    bucarDados();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 10, textAlign: "center" }}>Carregando dados...</Text>
      </View>
    );
  }

  return mostrarTela ? (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        {erroConexao ? (
          // Tela de erro de conexão
          <View style={styles.erroContainer}>
            <Text style={styles.erroTitulo}>Erro de Conexão</Text>
            <Text style={styles.erroMensagem}>
              Não foi possível conectar ao servidor.{"\n"}
              Verifique sua conexão com a internet.
            </Text>
            <Text style={styles.tentarNovamente} onPress={tentarReconectar}>
              Tentar Novamente
            </Text>
          </View>
        ) : (
          // Tela normal
          <>
            {/* Parte de cima com imagem */}
            <View style={styles.topContainer}>
              <Text style={styles.saudacao}>
                Olá, {nomePessoa}! {"\n"}Veja seu Peso em Tempo Real
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

                <Text style={styles.pesoMaximo}>
                  Peso máximo permitido: {Number(roundTo2(pesoMaximo))} Kg
                </Text>

                {/* Barra personalizada para comparação */}
                <View style={styles.barraContainer}>
                  <View style={[styles.barraEsquerda, { flex: percEsquerdo }]} />
                  <View style={[styles.barraDireita, { flex: percDireito }]} />
                </View>

                {/* Labels */}
                <View style={styles.labels}>
                  <Text style={{ color: "#F46334", fontWeight: "600" }}>
                    Esq.: {Math.round(Number(percEsquerdo) * 100)}% ({Number(pesoEsquerdo)} Kg)
                  </Text>
                  <Text style={{ color: "#36985B", fontWeight: "600" }}>
                    Dir.: {Math.round(Number(percDireito) * 100)}% ({Number(pesoDireito)} Kg)
                  </Text>
                </View>

                <Text style={styles.atualizacao}>
                  Atualizado {dataUltimaAtualizacao.toLocaleString()}
                </Text>
              </View>
            ) : (
              <Text style={styles.semMochila}>
                Nenhuma mochila em uso{"\n\n"}Selecione uma para começar
              </Text>
            )}
          </>
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
            routes: [{ name: "login" }],
          });
        }}
      />

      {/* Barra inferior */}
      <BottomNav
        navigation={navigation}
        onOpenSettings={() => setSettingsVisible(true)}
      />
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
    backgroundColor: "#eee",
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
  },
  barraContainer: {
    flexDirection: "row",
    width: "90%",
    height: 25,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 6,
    overflow: "hidden",
    marginTop: 5,
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
  saudacao: {
    color: "#000",
    fontWeight: "600",
    fontSize: 18,
    marginBottom: 30,
    textAlign: "center"
  },
  pesoMaximo: {
    color: "#000",
    fontWeight: "600",
    fontSize: 13,
    marginTop: 5
  },
  atualizacao: {
    color: "#000",
    fontWeight: "600",
    fontSize: 13,
    marginTop: 10
  },
  semMochila: {
    marginTop: 30,
    fontSize: 16,
    color: "gray",
    textAlign: "center",
    fontWeight: "600"
  },
  erroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  erroTitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#bd1c11ff',
    marginBottom: 10,
  },
  erroMensagem: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  tentarNovamente: {
    fontSize: 16,
    color: '#0000ff',
    fontWeight: '600',
  },
});