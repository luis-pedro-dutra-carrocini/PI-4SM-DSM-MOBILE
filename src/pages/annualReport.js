// annualReport.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ToastAndroid,
  Animated,
  Easing,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

import { LINKAPI, PORTAPI } from "../utils/global";
import {
  validarTokens,
  pegarTokens,
  obterDadosUsuario,
  roundTo2,
} from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

const screenWidth = Dimensions.get("window").width;

// --- FUNÇÕES AUXILIARES (mantive roundTo2 importado, caso precise) ---
const localSide = (local) => {
  if (!local) return "outro";
  const l = local.toString().toLowerCase();
  if (l.includes("esquer")) return "esquerda";
  if (l.includes("direit")) return "direita";
  if (l.includes("amb")) return "ambos";
  return "outro";
};

// --- COMPONENTE PRINCIPAL ---
export default function AnnualReportScreen({ navigation, route }) {
  const { codigo, nome } = route.params;

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [medicoes, setMedicoes] = useState([]); // opcional, mantido para compatibilidade
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const [pesoUsuario, setPesoUsuario] = useState(0);
  const [porcentagemMaxima, setPorcentagemMaxima] = useState(10);

  const [estatisticas, setEstatisticas] = useState(null);
  const [mediasMensais, setMediasMensais] = useState(Array(12).fill(0));

  const [statsExpanded, setStatsExpanded] = useState(true);
  const animVal = useRef(new Animated.Value(1)).current;

  const [processando, setProcessando] = useState(false);

  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];

  useEffect(() => {
    buscarDadosUsuario();
  }, []);

  useEffect(() => {
    if (pesoUsuario > 0) {
      buscarRelatorioAnual();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anoSelecionado, pesoUsuario]);

  // Buscar info do usuário (peso, %)
  const buscarDadosUsuario = async () => {
    try {
      const response = await obterDadosUsuario(navigation);
      if (response === "false") return;

      setPesoUsuario(response.usuario.UsuarioPeso || 70);
      setPorcentagemMaxima(response.usuario.UsuarioPesoMaximoPorcentagem || 10);
    } catch (error) {
      ToastAndroid.show("Erro ao conectar no servidor", ToastAndroid.SHORT);
      navigation.reset({ index: 0, routes: [{ name: "main" }] });
    }
  };

  // Buscar relatório no backend (API já calcula médias e estatísticas)
  const buscarRelatorioAnual = async () => {
    try {
      setLoading(true);
      setProcessando(true);
      setErro("");
      setMedicoes([]);
      setEstatisticas(null);
      setMediasMensais(Array(12).fill(0));

      const tokenValido = await validarTokens(0, navigation);
      if (tokenValido !== "true") {
        if (tokenValido === "false") return;
        return ToastAndroid.show(tokenValido, ToastAndroid.SHORT);
      }

      const { accessToken } = await pegarTokens();

      const response = await fetch(
        `${LINKAPI}${PORTAPI}/medicoes/anual/${anoSelecionado}/${codigo}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // receber corpo mesmo em 200
      const dados = await response.json();

      if (!response.ok) {
        // Caso a API retorne status de erro
        const msg = dados.error || dados.mensagem || "Erro ao obter relatório anual";
        setErro(msg);
        setProcessando(false);
        return;
      }

      // A API pode retornar mediasMensais e estatisticas ou mensagem de "sem medições"
      let medias = Array.isArray(dados.mediasMensais) ? dados.mediasMensais : Array(12).fill(0);
      // Garantir array de 12 elementos e valores numéricos
      medias = Array.from({ length: 12 }, (_, i) => {
        const v = medias[i];
        const n = typeof v === "number" && Number.isFinite(v) ? v : Number(parseFloat(v));
        return Number.isFinite(n) ? roundTo2(n) : 0;
      });

      setMediasMensais(medias);

      // Estatísticas podem ser nulas
      setEstatisticas(dados.estatisticas || null);

      // Manter campo medicoes para compatibilidade antiga (vazio pois API não retorna tudo)
      // Se a API retornar medicoes completas, você pode setar aqui: setMedicoes(dados.medicoes || []);
      setMedicoes([]); // reduz memória no mobile

    } catch (e) {
      console.error(e);
      setErro("Erro ao conectar no servidor.");
    } finally {
      setLoading(false);
      setProcessando(false);
    }
  };

  // UI Helpers - animação dos cards
  const toggleStats = () => {
    const toValue = statsExpanded ? 0 : 1;
    Animated.timing(animVal, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    setStatsExpanded(!statsExpanded);
  };

  const animatedHeight = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 140],
  });
  const animatedOpacity = animVal;

  const renderStatCard = (titulo, valor, cor, emoji) => {
    return (
      <View style={[styles.statCard, { borderLeftColor: cor }]} key={titulo}>
        <Text style={styles.statCardTitle}>
          {emoji} {titulo}
        </Text>
        <Text style={styles.statCardValue}>{valor}</Text>
      </View>
    );
  };

  const renderIndicadoresAnuais = () => {
    // Exibe somente se há estatísticas ou pelo menos uma média mensal > 0
    const temDados = mediasMensais.some(v => Number.isFinite(v) && v > 0);
    if (!temDados && !estatisticas) return null;

    const stats = estatisticas || {};

    return (
      <View style={styles.statsOuter}>
        <TouchableOpacity style={styles.statsHeader} onPress={toggleStats} activeOpacity={0.8}>
          <Text style={styles.statsHeaderText}>📈 Indicadores Estatísticos</Text>
          <Text style={styles.statsHeaderToggle}>{statsExpanded ? "Ocultar" : "Mostrar"}</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.statsAnimated, { height: animatedHeight, opacity: animatedOpacity }]}>
          <ScrollView horizontal contentContainerStyle={styles.statsGrid} showsHorizontalScrollIndicator={false}>
            {renderStatCard("Média", `${stats?.media ?? "—"} kg`, "#00BCD4", "")}
            {renderStatCard("Mediana", `${stats?.mediana ?? "—"} kg`, "#2196F3", "")}
            {renderStatCard("Moda", `${stats?.moda ?? "—"} kg`, "#9C27B0", "")}
            {renderStatCard("Desvio Padrão", `${stats?.desvioPadrao ?? "—"} kg`, "#FF9800", "")}
            {renderStatCard("Assimetria", `${stats?.assimetria ?? "—"}`, "#F44336", "")}
            {renderStatCard("Curtose", `${stats?.curtose ?? "—"}`, "#607D8B", "")}
            {renderStatCard("Regressão Linear", `${stats?.regrLinear ?? "—"}`, "#8BC34A", "")}
          </ScrollView>
        </Animated.View>
      </View>
    );
  };

  // Determina se temos dados suficientes para gráfico
  const possuiDadosGrafico = mediasMensais.some(v => Number.isFinite(v) && v > 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="#3A3A3A" />
        </TouchableOpacity>

        <Text style={styles.title}>Relatório Anual</Text>
        <Text style={styles.subtitle}>
          {"\n"}
          {nome}{"\n"}({codigo})
        </Text>

        <View style={styles.yearSelectorOuter}>
          <Text style={styles.label}>Ano:</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={anoSelecionado}
              style={styles.picker}
              onValueChange={(value) => setAnoSelecionado(value)}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return <Picker.Item key={year} label={year.toString()} value={year} />;
              })}
            </Picker>
          </View>
        </View>

        <TouchableOpacity style={styles.fetchButton} onPress={buscarRelatorioAnual}>
          <Text style={styles.fetchButtonText}>Buscar Relatório</Text>
        </TouchableOpacity>

        {loading || processando ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Carregando...</Text>
          </View>
        ) : erro ? (
          <Text style={styles.errorText}>{erro}</Text>
        ) : !possuiDadosGrafico && !estatisticas ? (
          <Text style={styles.infoText}>Nenhuma medição encontrada. Selecione outro ano e toque em "Buscar Relatório".</Text>
        ) : (
          <>
            {renderIndicadoresAnuais()}

            {/* Gráfico principal */}
            <Text style={styles.graphTitle}>📊 Média de Peso por Mês</Text>
            {possuiDadosGrafico ? (
              <LineChart
                data={{
                  labels: meses,
                  datasets: [
                    { data: mediasMensais, color: () => "#43a047", strokeWidth: 2 },
                  ],
                }}
                width={screenWidth - 20}
                height={220}
                yAxisSuffix="kg"
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#eee",
                  backgroundGradientTo: "#eee",
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(0, 88, 136, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  fillShadowGradient: "#43a047",
                  fillShadowGradientOpacity: 0.5,
                }}
                style={styles.graph}
                bezier
                fromZero
              />
            ) : (
              <Text style={styles.infoText}>Dados insuficientes para gerar o gráfico.</Text>
            )}

            {/* Detalhamento Mensal */}
            <View style={styles.monthlyDetailsOuter}>
              <Text style={styles.monthlyDetailsTitle}>📅 Detalhamento Mensal (Média)</Text>

              {mediasMensais.every((v) => v === 0) ? (
                <Text style={styles.infoText}>Nenhum dado disponível para exibir detalhamento.</Text>
              ) : (
                meses.map((mes, i) => {
                  let valor = mediasMensais[i];
                  if (!Number.isFinite(valor)) valor = 0; // garante número válido

                  return (
                    <View key={i} style={styles.monthBlock}>
                      <View style={styles.monthBlockHeader}>
                        <Text style={styles.monthName}>{mes}</Text>
                        <Text
                          style={[
                            styles.monthAvg,
                            { color: valor > 0 ? "#00796b" : "#9e9e9e" },
                          ]}
                        >
                          {valor.toFixed(2)} kg
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onToggleTheme={() => setDarkTheme(!darkTheme)}
        isDarkTheme={darkTheme}
        onLogout={() => {
          setSettingsVisible(false);
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        }}
      />
      <View style={styles.bottomContainer}>
        <BottomNav
          navigation={navigation}
          onOpenSettings={() => setSettingsVisible(true)}
        />
      </View>
    </View>
  );
}

// --- ESTILOS (reaproveitados do original) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eee" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 60,
    color: "#3A3A3A",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
  },
  dateButton: {
    alignSelf: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#9dadaf",
    marginBottom: 15,
  },
  dateButtonText: { fontSize: 16, color: "#333" },
  label: { fontSize: 16, color: "#333", marginRight: 10 },
  picker: { height: 50, width: 150 },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#b0bec5",
    overflow: "hidden",
    height: 50,
    width: 150,
  },
  fetchButton: {
    backgroundColor: "#2e7d32",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 25,
    alignSelf: "center",
    marginBottom: 20,
  },
  fetchButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  loadingContainer: { alignItems: "center", marginTop: 30 },
  errorText: { color: "red", textAlign: "center", marginTop: 20 },
  infoText: { textAlign: "center", color: "#555", marginTop: 40 },
  graphTitle: { fontSize: 18, textAlign: "center", marginVertical: 10, color: "#333" },
  graph: { alignSelf: "center", borderRadius: 10 },
  bottomContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  backButton: { position: "absolute", top: 40, left: 20 },

  // Estilos de Indicadores (Adicionados)
  statsOuter: {
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d0d7d7",
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#e8f5e9",
  },
  statsHeaderText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2e7d32",
  },
  statsHeaderToggle: {
    fontSize: 14,
    color: "#2e7d32",
  },
  statsAnimated: {
    paddingVertical: 8,
    height: 120,
  },
  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  statCard: {
    backgroundColor: "#fff",
    minWidth: 150,
    maxWidth: 1000,
    marginRight: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 2,
    borderLeftWidth: 6,
    borderLeftColor: "#4CAF50",
    flexShrink: 0,
  },
  statCardTitle: {
    fontSize: 13,
    color: "#333",
    fontWeight: "600",
    marginBottom: 6,
  },
  statCardValue: {
    fontSize: 16,
    color: "#111",
    fontWeight: "700",
  },

  // outros estilos reaproveitados
  yearSelectorOuter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#b0bec5",
    overflow: "hidden",
    height: 50,
    width: 150,
  },
  picker: {
    width: "100%",
    height: 50,
  },

  // cards / layout
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    marginHorizontal: 10,
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#333" },
  cardValue: { fontSize: 18, fontWeight: "800", color: "#0288d1", marginTop: 6 },

  // extras
  loadingText: { textAlign: "center", marginTop: 8 },
  emptyChart: { textAlign: "center", color: "#777", marginTop: 8 },

  // --- Detalhamento Mensal ---
  monthlyDetailsOuter: {
    backgroundColor: "#fff",
    marginHorizontal: 10,
    marginTop: 15,
    marginBottom: 25,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d0d7d7",
    paddingVertical: 10,
    paddingHorizontal: 12,
    elevation: 2,
  },
  monthlyDetailsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2e7d32",
    marginBottom: 10,
  },
  monthBlock: {
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
    paddingVertical: 8,
  },
  monthBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  monthAvg: {
    fontSize: 15,
    fontWeight: "700",
    color: "#00796b",
  },

});
