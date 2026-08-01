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
}

// Keeps the header buttons/slider in sync with state
function updateControls() {
  d3.select("#scene-indicator").text("Scene " + state.scene + " of 3");
  d3.select("#prevBtn").property("disabled", state.scene === 1);
  d3.select("#nextBtn").property("disabled", state.scene === 3);
}

function drawScatter() {
  console.log("Drawing scatter for all years");

  d3.select("#scene-title").text("Scene 1 — The Whole Picture: COVID-19 Deaths vs. Cases by Country 2020 - 2023");
  d3.select("#scene-subtitle").text("This visualization shows the global trend of fatality rate by median age group per country. As you can see, dots representing countries withhigher median age groups gravitate towards the higher fatality rate area (upper right corner) while low median age groups gravitate towards the lower fatality rate are (lower left corner).  Each dot is a country. Color = median-age group. Both axes are log scale. ");

  const svg = d3.select("#viz");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 30, right: 175, bottom: 55, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const validRows = data.filter(function(d) {
    return d["Cases per 100k"] > 0 && d["Deaths per 100k"] > 0;
  });

  // One dot per country: average each country's Cases/Deaths per 100k across 2020-2023
  const byCountry = d3.group(validRows, d => d.Country);

  const filtered = Array.from(byCountry, function([country, rows]) {
    // use the most common age group for that country across all years
    const groupCounts = {};
    rows.forEach(function(d) {
      groupCounts[d["Age Group"]] = (groupCounts[d["Age Group"]] || 0) + 1;
    });
    let ageGroup = rows[rows.length - 1]["Age Group"];
    let bestCount = 0;
    for (const g in groupCounts) {
      if (groupCounts[g] > bestCount) {
        bestCount = groupCounts[g];
        ageGroup = g;
      }
    }

    return {
      Country: country,
      "Cases per 100k": d3.mean(rows, d => d["Cases per 100k"]),
      "Deaths per 100k": d3.mean(rows, d => d["Deaths per 100k"]),
      "Age Group": ageGroup
    };
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

  // Dots — reveal one age group at a time, youngest to oldest
  const groupDelayStep = 1000;
  const groupFadeDuration = 1000;

  g.selectAll("circle")
    .data(filtered)
    .enter()
    .append("circle")
    .attr("cx", d => x(d["Cases per 100k"]))
    .attr("cy", d => y(d["Deaths per 100k"]))
    .attr("r", 5)
    .attr("fill", d => color(d["Age Group"]))
    .attr("stroke", "white")
    .style("opacity", 0)
    .transition()
    .delay(d => ageGroups.indexOf(d["Age Group"]) * groupDelayStep)
    .duration(groupFadeDuration)
    .style("opacity", 0.75);

  // Legend
  const legend = g.append("g")
    .attr("transform", "translate(" + (innerWidth + 20) + ", 0)");

  legend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .style("font-size", "11pt")
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

  // Annotations — give more details on 2 extremes after all dots have appeared
  const annotations = [];

  const bulgariaDot = filtered.find(d => d.Country === "Bulgaria");
  if (bulgariaDot) {
    annotations.push({
      note: {
        title: "Bulgaria — median age 45",
        label: "Oldest countries cluster at the top: 336 deaths per 100k in 2021.",
        wrap: 220
      },
      x: x(bulgariaDot["Cases per 100k"]),
      y: y(bulgariaDot["Deaths per 100k"]),
      dx: -60,
      dy: -10
    });
  }

  const nigerDot = filtered.find(d => d.Country === "Niger");
  if (nigerDot) {
    annotations.push({
      note: {
        title: "Niger — median age 16",
        label: "Youngest countries sit near the bottom: under 1 death per 100k.",
        wrap: 220
      },
      x: x(nigerDot["Cases per 100k"]),
      y: y(nigerDot["Deaths per 100k"]),
      dx: 20,
      dy: -160
    });
  }

  const makeAnnotations = d3.annotation()
    .type(d3.annotationCalloutElbow)
    .annotations(annotations);

  const dotsFinishTime = (ageGroups.length - 1) * groupDelayStep + groupFadeDuration;

  g.append("g")
    .attr("class", "annotation-group")
    .style("opacity", 0)
    .call(makeAnnotations)
    .transition()
    .delay(dotsFinishTime)
    .duration(500)
    .style("opacity", 1);
}

function drawBars() {
  d3.select("#scene-title").text("Scene 2 — Age Drives Mortality: Average Death Rate by Median Age Group");
  d3.select("#scene-subtitle").text("Averaging every country-year from 2020–2023, the death rate climbs steadily with median age. Countries with median age 45+ averaged roughly 12 times the death rate of countries with median age under 25.");

  const svg = d3.select("#viz");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 30, right: 175, bottom: 55, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const ageGroups = ["Under 25", "25-34", "35-44", "45+"];
  const color = d3.scaleOrdinal()
    .domain(ageGroups)
    .range(["#fee08b", "#fdae61", "#f46d43", "#9e0142"]);

  // Average death rate per age group, pooling every country and every year
  const meansByGroup = d3.rollup(
    data,
    rows => d3.mean(rows, d => d["Deaths per 100k"]),
    d => d["Age Group"]
  );

  const barData = ageGroups.map(function(group) {
    return { group: group, mean: meansByGroup.get(group) };
  });

  const x = d3.scaleBand()
    .domain(ageGroups)
    .range([0, innerWidth])
    .padding(0.35);

  const y = d3.scaleLinear()
    .domain([0, d3.max(barData, d => d.mean)])
    .range([innerHeight, 0])
    .nice();

  // Axes
  g.append("g")
    .attr("transform", "translate(0," + innerHeight + ")")
    .call(d3.axisBottom(x));

  g.append("g")
    .call(d3.axisLeft(y));

  g.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 45)
    .attr("text-anchor", "middle")
    .text("Country median age group");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .text("Avg deaths per 100,000 (2020–2023)");

  // Bars — grow from the x-axis upward, one at a time, youngest to oldest
  const groupDelayStep = 1000;
  const groupGrowDuration = 800;

  g.selectAll("rect.bar")
    .data(barData)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.group))
    .attr("width", x.bandwidth())
    .attr("fill", d => color(d.group))
    .attr("stroke", "white")
    .attr("y", y(0))
    .attr("height", 0)
    .transition()
    .delay((_, i) => i * groupDelayStep)
    .duration(groupGrowDuration)
    .attr("y", d => y(d.mean))
    .attr("height", d => innerHeight - y(d.mean));

  // Value labels — fade in after each bar finishes growing
  g.selectAll("text.bar-label")
    .data(barData)
    .enter()
    .append("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.group) + x.bandwidth() / 2)
    .attr("y", d => y(d.mean) - 10)
    .attr("text-anchor", "middle")
    .style("opacity", 0)
    .text(d => d.mean.toFixed(1))
    .transition()
    .delay((_, i) => i * groupDelayStep + groupGrowDuration)
    .duration(300)
    .style("opacity", 1);

  // Annotation — fades in after every bar has finished growing
  const oldestBar = barData[barData.length - 1];

  const annotations = [{
    note: {
      title: "45+ group: 73 deaths per 100k",
      label: "Roughly 12× the average death rate of countries with median age under 25 (6.1 per 100k).",
      wrap: 220
    },
    x: x(oldestBar.group) + x.bandwidth() / 2,
    y: y(oldestBar.mean),
    dx: -100,
    dy: 0
  }];

  const makeAnnotations = d3.annotation()
    .type(d3.annotationCalloutElbow)
    .annotations(annotations);

  const barsFinishTime = (ageGroups.length - 1) * groupDelayStep + groupGrowDuration;

  g.append("g")
    .attr("class", "annotation-group")
    .style("opacity", 0)
    .call(makeAnnotations)
    .transition()
    .delay(barsFinishTime)
    .duration(500)
    .style("opacity", 1);
}
