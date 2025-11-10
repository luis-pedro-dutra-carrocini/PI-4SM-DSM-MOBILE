import React, { useEffect, useState, useRef } from "react";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Ionicons } from "@expo/vector-icons";

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

// --- Componente Principal ---

export default function MonthlyReportScreen({ navigation, route }) {
  const { codigo, nome } = route.params;

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  // isProcessing foi removido pois o processamento é feito na API
  const [erro, setErro] = useState("");

  // Estado para armazenar o objeto de estatísticas calculado pela API
  const [estatisticas, setEstatisticas] = useState(null);

  // Estado para armazenar o objeto de dados processados calculado pela API
  const [dadosProcessados, setDadosProcessados] = useState({
    dailyAvgs: [],
    dailyLabels: [], // Adicionado para rótulos de dias
    dailyAvgsEsq: [], // Adicionado para gráfico comparativo
    dailyAvgsDir: [], // Adicionado para gráfico comparativo
    maiorEsq: null,
    maiorDir: null,
    menorEsq: null,
    menorDir: null,
    totalMedicoes: 0,
    mediçõesAcimaLimite: 0,
    diasComMedicao: 0,
    pesoMaximoPermitido: 0,
  });

  const [statsExpanded, setStatsExpanded] = useState(true);
  const animVal = useRef(new Animated.Value(1)).current;

  // Dados do usuário são apenas auxiliares para o front-end exibir o limite
  const [pesoUsuario, setPesoUsuario] = useState(0);
  const [porcentagemMaxima, setPorcentagemMaxima] = useState(10);

  useEffect(() => {
    bucarDadosUsuario();
  }, []);

  const bucarDadosUsuario = async () => {
    try {
      const response = await obterDadosUsuario(navigation);
      if (response === "false") return;

      setPesoUsuario(response.usuario.UsuarioPeso || 70);
      setPorcentagemMaxima(
        response.usuario.UsuarioPesoMaximoPorcentagem || 10
      );
    } catch (error) {
      ToastAndroid.show("Erro ao obter dados do usuário", ToastAndroid.SHORT);
    }
  };

  useEffect(() => {
    buscarRelatorioMensal();
  }, [selectedDate]);

  const handleMonthChange = (event, date) => {
    setShowDatePicker(false);
    if (date) setSelectedDate(date);
  };

  // A função processarMedicoes e suas auxiliares foram REMOVIDAS daqui
  // e movidas para a API.

  const buscarRelatorioMensal = async () => {
    try {
      setLoading(true);
      setErro("");

      // Limpa os estados antes de buscar
      setEstatisticas(null);
      setDadosProcessados({
        dailyAvgs: [], dailyLabels: [], dailyAvgsEsq: [], dailyAvgsDir: [],
        maiorEsq: null, maiorDir: null, menorEsq: null, menorDir: null,
        totalMedicoes: 0, mediçõesAcimaLimite: 0, diasComMedicao: 0,
        pesoMaximoPermitido: 0,
      });

      const resposta = await validarTokens(0, navigation);
      if (resposta !== "true")
        return ToastAndroid.show(resposta, ToastAndroid.SHORT);

      const tokens = await pegarTokens();
      const { accessToken } = tokens;

      const mes = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const ano = selectedDate.getFullYear();

      const response = await fetch(
        `${LINKAPI}${PORTAPI}/medicoes/mensal/${ano}/${mes}/${codigo}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const erroData = await response.json();
        setErro(erroData.error || "Erro ao obter relatório mensal");
        return;
      }

      // Recebe o objeto JÁ PROCESSADO da API
      const resultado = await response.json();

      // Atualiza os estados diretamente com os dados calculados
      setEstatisticas(resultado.estatisticas);
      setDadosProcessados(resultado.dadosProcessados);

      // Remove a chamada de processamento local

    } catch (e) {
      console.error(e);
      setErro("Erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };


  const {
    dailyAvgs,
    dailyLabels, // Novo campo da API
    dailyAvgsEsq, // Novo campo da API
    dailyAvgsDir, // Novo campo da API
    maiorEsq,
    maiorDir,
    menorEsq,
    menorDir,
    totalMedicoes,
    mediçõesAcimaLimite,
    diasComMedicao,
    pesoMaximoPermitido,
  } = dadosProcessados;

  // O chartData não é mais criado aqui. Ele é construído diretamente no LineChart
  // usando os dados prontos da API: dailyAvgs e dailyLabels.

  // dailyAvgsEsq e dailyAvgsDir agora vêm prontos da API:
  // const dailyAvgsEsq = dadosProcessados.dailyAvgsEsq;
  // const dailyAvgsDir = dadosProcessados.dailyAvgsDir;

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

  const renderStatCard = (titulo, valor, cor, emoji, footer = null) => {
    return (
      <View style={[styles.statCard, { borderLeftColor: cor }]}>
        <Text style={styles.statCardTitle}>
          {emoji} {titulo}
        </Text>
        <Text style={styles.statCardValue}>{valor}</Text>
        {footer && <Text style={styles.statCardFooter}>{footer}</Text>}
      </View>
    );
  };

  const renderIndicadores = () => {
    if (totalMedicoes === 0) return null;

    const estatisticasCalculadas = estatisticas;

    const percentualAcimaLimite = totalMedicoes > 0 ? (
      (mediçõesAcimaLimite / totalMedicoes) *
      100
    ).toFixed(1) : "0.0";

    return (
      <View style={styles.statsOuter}>
        <TouchableOpacity style={styles.statsHeader} onPress={toggleStats} activeOpacity={0.8}>
          <Text style={styles.statsHeaderText}>📈 Indicadores Estatísticos</Text>
          <Text style={styles.statsHeaderToggle}>{statsExpanded ? "Ocultar" : "Mostrar"}</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.statsAnimated, { height: animatedHeight, opacity: animatedOpacity }]}>
          <ScrollView horizontal contentContainerStyle={styles.statsGrid} showsHorizontalScrollIndicator={false}>
            {renderStatCard(
              "Total Medições",
              `${totalMedicoes}`,
              "#2196F3"
            )}

            {renderStatCard(
              "Dias c/ Medição",
              `${diasComMedicao}`,
              "#4CAF50"
            )}

            {renderStatCard(
              "Média Total",
              `${estatisticasCalculadas?.media ?? "—"} kg`,
              "#00BCD4"
            )}

            {renderStatCard(
              "Mediana",
              `${estatisticasCalculadas?.mediana ?? "—"} kg`,
              "#2196F3"
            )}

            {renderStatCard(
              "Moda",
              `${estatisticasCalculadas?.moda ?? "—"} kg`,
              "#9C27B0"
            )}

            {renderStatCard(
              "Desvio Padrão",
              `${estatisticasCalculadas?.desvioPadrao ?? "—"} kg`,
              "#FF9800"
            )}

            {renderStatCard(
              "Assimetria",
              `${estatisticasCalculadas?.assimetria ?? "—"}`,
              "#F44336"
            )}

            {renderStatCard(
              "Curtose",
              `${estatisticasCalculadas?.curtose ?? "—"}`,
              "#607D8B"
            )}

            {renderStatCard(
              "Regressão Linear",
              estatisticasCalculadas?.regressao
                ? `y = ${estatisticasCalculadas.regressao.a}x + ${estatisticasCalculadas.regressao.b}`
                : "Não aplicável",
              "#455A64"
            )}
          </ScrollView>
        </Animated.View>
      </View>
    );
  };

  const renderMedicaoCard = (titulo, medicao, tipo) => {
    // A data vem como string ISO da API e precisa ser convertida
    if (!medicao) return null;
    const acimaLimite = medicao.peso > pesoMaximoPermitido;
    return (
      <View
        style={[
          styles.card,
          acimaLimite && styles.alertCard,
          {
            borderLeftWidth: 6,
            borderLeftColor: tipo === "maior" ? "#d32f2f" : "#43a047",
          },
        ]}
      >
        <Text style={styles.bold}>
          {tipo === "maior" ? "📈" : "📉"} {titulo} ({medicao.lado})
        </Text>
        <Text>
          Data:{" "}
          {format(parseISO(medicao.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </Text>
        <Text>Peso: {medicao.peso.toFixed(2)} kg</Text>
        {acimaLimite && (
          <Text style={styles.alertText}>
            ⚠️ Acima do limite permitido ({pesoMaximoPermitido.toFixed(2)} kg)
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={28} color="#3A3A3A" />
        </TouchableOpacity>

        <Text style={styles.title}>Relatório Mensal</Text>
        <Text style={styles.subtitle}>
          {nome}
          {"\n"}({codigo})
        </Text>

        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateButtonText}>
            📆 {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleMonthChange}
          />
        )}

        <TouchableOpacity style={styles.fetchButton} onPress={buscarRelatorioMensal}>
          <Text style={styles.fetchButtonText}>Buscar Relatório</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Carregando dados e processando gráficos...</Text>
          </View>
        ) : erro ? (
          <Text style={styles.errorText}>{erro}</Text>
        ) : totalMedicoes === 0 ? (
          <Text style={styles.infoText}>Nenhuma medição encontrada.</Text>
        ) : (
          <>
            {renderIndicadores()}

            <Text style={styles.graphTitle}>📊 Média Diária do Mês</Text>

            {/* 🎯 Gráfico da Média Diária Total */}
            {dailyAvgs.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <LineChart
                  data={{
                    labels: dailyLabels, // Dados da API
                    datasets: [
                      { data: dailyAvgs, color: () => "#43a047" } // Dados da API
                    ],
                    legend: ["Média Diária do Mês"]
                  }}
                  width={Math.max(screenWidth, dailyAvgs.length * 40)}
                  height={220}
                  yAxisSuffix="kg"
                  chartConfig={{
                    backgroundColor: "#fff",
                    backgroundGradientFrom: "#fff",
                    backgroundGradientTo: "#fff",
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(67, 160, 71, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "5", strokeWidth: "2", stroke: "#43a047" },
                  }}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 16 }}
                />
              </ScrollView>

            )}

            {dailyAvgs.length === 0 && (
              <Text style={styles.infoText}>Gráfico da Média Diária indisponível.</Text>
            )}

            <Text style={[styles.graphTitle, { marginTop: 25 }]}>
              ⚖️ Comparativo Esquerda x Direita
            </Text>

            {/* 🎯 Gráfico Comparativo Esquerda x Direita */}
            {dailyAvgsEsq.length > 0 && dailyAvgsDir.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <LineChart
                  data={{
                    labels: dailyLabels, // Dados da API
                    datasets: [
                      { data: dailyAvgsEsq, color: () => "#F46334" }, // Dados da API
                      { data: dailyAvgsDir, color: () => "#36985B" }, // Dados da API
                    ],
                    legend: ["Esquerda", "Direita"]
                  }}
                  width={Math.max(screenWidth, dailyAvgs.length * 40)}
                  height={220}
                  yAxisSuffix="kg"
                  chartConfig={{
                    backgroundColor: "#fff",
                    backgroundGradientFrom: "#fff",
                    backgroundGradientTo: "#fff",
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: "5", strokeWidth: "2", stroke: "#333" },
                  }}
                  bezier
                  style={{ marginVertical: 8, borderRadius: 16 }}
                />
              </ScrollView>

            ) : (
              <Text style={styles.infoText}>Gráfico Comparativo indisponível ou dados insuficientes.</Text>
            )}

            {renderMedicaoCard("Maior Medição", maiorEsq, "maior")}
            {renderMedicaoCard("Maior Medição", maiorDir, "maior")}
            {renderMedicaoCard("Menor Medição", menorEsq, "menor")}
            {renderMedicaoCard("Menor Medição", menorDir, "menor")}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eee" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 60,
    color: "#3A3A3A",
  },
  subtitle: { textAlign: "center", color: "#555", marginBottom: 20 },
  dateButton: {
    alignSelf: "center",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#9dadaf",
    marginBottom: 15,
  },
  dateButtonText: { fontSize: 16, color: "#333" },
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
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 14,
    borderRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#b0bec5",
  },
  alertCard: {
    borderColor: "#d32f2f",
    backgroundColor: "#ffebee",
    borderWidth: 2,
  },
  alertText: { color: "#d32f2f", marginTop: 5, fontWeight: "bold" },
  bold: { fontWeight: "bold", color: "#000" },
  graphTitle: {
    fontSize: 18,
    textAlign: "center",
    marginVertical: 10,
    color: "#333",
  },
  graph: { alignSelf: "center", borderRadius: 10 },
  bottomContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  backButton: { position: "absolute", top: 40, left: 20 },

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
    flexShrink: 1,
    flexWrap: "nowrap",
  },
  statCardFooter: {
    fontSize: 12,
    color: "#555",
    marginTop: 3,
  }
});