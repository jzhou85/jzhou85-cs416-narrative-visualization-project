// Parameters
let state = { scene: 1, year: 2021, selectedCountry: null };

let data, worldTopo;

Promise.all([
  d3.csv("data/covid_yearly.csv", d3.autoType),
  d3.json("data/countries-110m.json")
]).then(([csv, topo]) => {
  data = csv; worldTopo = topo;
  render();
});

// Scene Dispatcher — clear and repopulate
function render() {
  d3.select("#viz").selectAll("*").remove();
  if (state.scene === 1) drawScatter();
  if (state.scene === 2) drawBars();
  if (state.scene === 3) drawMap();
  updateControls();
}

// Triggers
d3.select("#nextBtn").on("click", () => { state.scene = Math.min(3, state.scene + 1); render(); });
d3.select("#prevBtn").on("click", () => { state.scene = Math.max(1, state.scene - 1); render(); });
d3.select("#yearSlider").on("input", function() { state.year = +this.value; render(); });