import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ToastAndroid,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { format } from "date-fns";

import { LINKAPI, PORTAPI } from "../utils/global";
import {
  validarTokens,
  pegarTokens,
  obterDadosUsuario,
} from "../utils/validacoes";

import BottomNav from "../components/BottomNav";
import SettingsModal from "../components/SettingsModal";

const screenWidth = Dimensions.get("window").width;

export default function AnnualReportScreen({ navigation, route }) {
  const { codigo, nome } = route.params;

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [darkTheme, setDarkTheme] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [medicoes, setMedicoes] = useState([]);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const [pesoUsuario, setPesoUsuario] = useState(0);
  const [porcentagemMaxima, setPorcentagemMaxima] = useState(10);

  useEffect(() => {
    buscarDadosUsuario();
  }, []);

  useEffect(() => {
    if (pesoUsuario > 0) {
      buscarRelatorioAnual();
    }
  }, [anoSelecionado, pesoUsuario]);

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

  const buscarRelatorioAnual = async () => {
    try {
      setLoading(true);
      setErro("");
      setMedicoes([]);

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

      if (!response.ok) {
        const erroData = await response.json();
        setErro(erroData.error || "Erro ao obter relatório anual");
        return;
      }

      const dados = await response.json();
      setMedicoes(dados);
    } catch (e) {
      console.error(e);
      setErro("Erro ao conectar no servidor.");
    } finally {
      setLoading(false);
    }
  };

  // Agrupa medições por mês
  const agruparPorMes = () => {
    const grupos = {};
    medicoes.forEach((item) => {
      const data = new Date(item.MedicaoData);
      const mes = data.getMonth(); // 0 a 11
      if (!grupos[mes]) grupos[mes] = [];
      grupos[mes].push(item);
    });
    return grupos;
  };

  const grupos = agruparPorMes();

  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];

  const mediasMensais = meses.map((_, i) => {
    const med = grupos[i];
    if (!med || med.length === 0) return 0;

    const esquerda = med.filter((m) =>
      m.MedicaoLocal?.toLowerCase().includes("esquerda")
    );
    const direita = med.filter((m) =>
      m.MedicaoLocal?.toLowerCase().includes("direita")
    );

    const mediaEsq =
      esquerda.reduce((a, b) => a + Number(b.MedicaoPeso || 0), 0) /
      (esquerda.length || 1);
    const mediaDir =
      direita.reduce((a, b) => a + Number(b.MedicaoPeso || 0), 0) /
      (direita.length || 1);

    return parseFloat((mediaEsq + mediaDir).toFixed(2));
  });

  const pesoMaximoPermitido = pesoUsuario * (porcentagemMaxima / 100);

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

        {/* Seleção de Ano */}
        <View style={styles.yearSelector}>
          <Text style={styles.label}>Ano:</Text>
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

        <TouchableOpacity style={styles.fetchButton} onPress={buscarRelatorioAnual}>
          <Text style={styles.fetchButtonText}>Buscar Relatório</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text>Carregando...</Text>
          </View>
        ) : erro ? (
          <Text style={styles.errorText}>{erro}</Text>
        ) : medicoes.length === 0 ? (
          <Text style={styles.infoText}>Selecione um ano e toque em "Buscar Relatório".</Text>
        ) : (
          <>
            {/* Gráfico principal */}
            <Text style={styles.graphTitle}>📊 Média de Peso por Mês</Text>
            <LineChart
              data={{
                labels: meses,
                datasets: [
                  { data: mediasMensais, color: () => "#0288d1", strokeWidth: 2 },
                ],
              }}
              width={screenWidth - 20}
              height={220}
              yAxisSuffix="kg"
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#e0f7fa",
                backgroundGradientTo: "#b2ebf2",
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(0, 88, 136, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              style={styles.graph}
              bezier
              fromZero
            />

            {/* Gráfico comparativo */}
            <Text style={[styles.graphTitle, { marginTop: 25 }]}>
              ⚖️ Comparativo Esquerda x Direita{"\n"}(Médias Mensais)
            </Text>

            <LineChart
              data={{
                labels: meses,
                datasets: [
                  {
                    data: meses.map((_, i) => {
                      const med = grupos[i];
                      if (!med || med.length === 0) return 0;
                      const esquerda = med.filter((m) =>
                        m.MedicaoLocal?.toLowerCase().includes("esquerda")
                      );
                      const mediaEsq =
                        esquerda.reduce((a, b) => a + Number(b.MedicaoPeso || 0), 0) /
                        (esquerda.length || 1);
                      return parseFloat(mediaEsq.toFixed(2));
                    }),
                    color: () => "#1976d2",
                    strokeWidth: 2,
                  },
                  {
                    data: meses.map((_, i) => {
                      const med = grupos[i];
                      if (!med || med.length === 0) return 0;
                      const direita = med.filter((m) =>
                        m.MedicaoLocal?.toLowerCase().includes("direita")
                      );
                      const mediaDir =
                        direita.reduce((a, b) => a + Number(b.MedicaoPeso || 0), 0) /
                        (direita.length || 1);
                      return parseFloat(mediaDir.toFixed(2));
                    }),
                    color: () => "#43a047",
                    strokeWidth: 2,
                  },
                ],
                legend: ["Esquerda", "Direita"],
              }}
              width={screenWidth - 20}
              height={180}
              yAxisSuffix="kg"
              chartConfig={{
                backgroundColor: "#fff",
                backgroundGradientFrom: "#e0f7fa",
                backgroundGradientTo: "#b2ebf2",
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                propsForDots: { r: "4", strokeWidth: "2" },
                propsForBackgroundLines: { strokeDasharray: "3" },
              }}
              style={[styles.graph, { marginBottom: 10 }]}
            />
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
        <BottomNav navigation={navigation} onOpenSettings={() => setSettingsVisible(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#e0f7fa" },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3A3A3A",
    textAlign: "center",
    marginTop: 60,
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
  fetchButton: {
    backgroundColor: "#0288d1",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 25,
    alignSelf: "center",
    marginBottom: 20,
  },
  fetchButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  loadingContainer: { alignItems: "center", marginTop: 30 },
  errorText: { color: "red", textAlign: "center", marginTop: 20, fontSize: 16 },
  infoText: { textAlign: "center", color: "#555", marginTop: 40, fontSize: 15 },
  graphTitle: { fontSize: 18, textAlign: "center", marginBottom: 10, color: "#333" },
  graph: { alignSelf: "center", borderRadius: 10 },
  blockContainer: {
    marginHorizontal: 10,
    marginVertical: 6,
    borderRadius: 12,
    backgroundColor: "#f9f9f9",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: "hidden",
  },
  blockHeader: {
    backgroundColor: "#e0f2f1",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#00695c",
  },
  blockToggle: {
    fontSize: 18,
    color: "#004d40",
  },
  subBlock: {
    marginTop: 6,
    backgroundColor: "#f1f8e9",
    borderRadius: 10,
    marginHorizontal: 10,
    paddingBottom: 8,
  },
  subBlockTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#33691e",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginVertical: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#b0bec5",
  },
  // ESTILOS ADICIONADOS PARA A LÓGICA DE PESO PERMITIDO
  positiveCard: {
    borderColor: "#4CAF50", // Verde - Positivo (dentro do limite)
    borderWidth: 2,
  },
  negativeCard: {
    borderColor: "#F44336", // Vermelho - Negativo (limite excedido)
    borderWidth: 2,
    backgroundColor: "#FFEBEE", // Fundo levemente vermelho para destaque
  },
  alertText: {
    color: "#D32F2F",
    fontWeight: "bold",
    marginTop: 5,
    fontSize: 14,
  },
  // FIM DOS ESTILOS ADICIONADOS

  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTime: { fontSize: 15, fontWeight: "bold", color: "#0288d1" },
  balanceLine: {
    width: 60,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2196F3", // cor padrão (azul)
    marginVertical: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  balanceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
  },
  ladoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
  },
  blockHeaderExpanded: {
    backgroundColor: "#b2dfdb",
  },
  subBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#dcedc8",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  subBlockHeaderExpanded: {
    backgroundColor: "#c5e1a5",
  },
  cardText: { fontSize: 15, color: "#333", marginTop: 5 },
  bold: { fontWeight: "bold" },
  bottomContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
  backButton: { position: "absolute", top: 40, left: 20 },
  yearSelector: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
  },
  label: { fontSize: 16, fontWeight: "bold", marginRight: 10 },
  picker: {
    height: 50,
    width: 150,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
});
