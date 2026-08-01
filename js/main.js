document.addEventListener('DOMContentLoaded', init);

let state = { scene: 1, year: 2021, selectedCountry: null };
let data, worldTopo;

async function init() {
  data = await d3.csv("data/covid_yearly.csv", d3.autoType);
  worldTopo = await d3.json("data/countries-110m.json");

  console.log("Data loaded:", data.length, "rows");

  render();

  d3.select("#nextBtn").on("click", function() {
    state.scene = Math.min(3, state.scene + 1);
    render();
  });

  d3.select("#prevBtn").on("click", function() {
    state.scene = Math.max(1, state.scene - 1);
    render();
  });
}

// Scene Dispatcher — clear and repopulate
function render() {
  d3.select("#viz").selectAll("*").remove();
  if (state.scene === 1) drawScatter();
  if (state.scene === 2) drawBars();
  if (state.scene === 3) drawMap();
  updateControls();

  // Wrap the subtitle to the same width as the title text.
  const titleNode = document.getElementById("scene-title");
  const titleStyle = getComputedStyle(titleNode);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = titleStyle.fontWeight + " " + titleStyle.fontSize + " " + titleStyle.fontFamily;
  const titleTextWidth = ctx.measureText(titleNode.textContent).width;

  // Don't let the subtitle stretch past the header's own available width
  const containerWidth = document.getElementById("header").clientWidth;
  const wrapWidth = Math.min(titleTextWidth, containerWidth);
  d3.select("#scene-subtitle").style("width", wrapWidth + "px");
}

// Keeps the header buttons/slider in sync with state
function updateControls() {
  d3.select("#scene-indicator").text("Scene " + state.scene + " of 3");
  d3.select("#prevBtn").property("disabled", state.scene === 1);
  d3.select("#nextBtn").property("disabled", state.scene === 3);
}

function drawScatter() {
  console.log("Drawing scatter for year", state.year);

  d3.select("#scene-title").text("Scene 1 — The Whole Picture: COVID-19 Deaths vs. Cases by Country 2020 - 2023");
  d3.select("#scene-subtitle").text("Each dot is a country. Color = median-age group. Both axes are log scale. This visualization shows the global trend of fatality rate by median age group. As you can see, dots representing higher median age groups gravitate towards the higher fatality rate area (upper right corner) while low median age groups gravitate towards the lower fatality rate are (lower left corner).");

  const svg = d3.select("#viz");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 30, right: 175, bottom: 55, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const filtered = data.filter(function(d) {
    return d.Year === state.year && d["Cases per 100k"] > 0 && d["Deaths per 100k"] > 0;
  });

  const x = d3.scaleLog()
    .domain(d3.extent(filtered, d => d["Cases per 100k"]))
    .range([0, innerWidth])
    .nice();

  const y = d3.scaleLog()
    .domain(d3.extent(filtered, d => d["Deaths per 100k"]))
    .range([innerHeight, 0])
    .nice();

  const ageGroups = ["Under 25", "25-34", "35-44", "45+"];
  const color = d3.scaleOrdinal()
    .domain(ageGroups)
    .range(["#fee08b", "#fdae61", "#f46d43", "#9e0142"]);

  // Axes
  g.append("g")
    .attr("transform", "translate(0," + innerHeight + ")")
    .call(d3.axisBottom(x).ticks(6, "~s"));

  g.append("g")
    .call(d3.axisLeft(y).ticks(6, "~s"));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 45)
    .attr("text-anchor", "middle")
    .text("Cases per 100,000 (log)");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .text("Deaths per 100,000 (log)");

  // Dots
  g.selectAll("circle")
    .data(filtered)
    .enter()
    .append("circle")
    .attr("cx", d => x(d["Cases per 100k"]))
    .attr("cy", d => y(d["Deaths per 100k"]))
    .attr("r", 5)
    .attr("fill", d => color(d["Age Group"]))
    .attr("opacity", 0.75)
    .attr("stroke", "white");

  // Legend
  const legend = g.append("g")
    .attr("transform", "translate(" + (innerWidth + 20) + ", 0)");

  legend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .text("Country median age");

  ageGroups.forEach(function(group, i) {
    const row = legend.append("g")
      .attr("transform", "translate(0, " + (22 + i * 22) + ")");

    row.append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", color(group));

    row.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .style("font-size", "12px")
      .text(group);
  });
}
