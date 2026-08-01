document.addEventListener('DOMContentLoaded', init);

async function init() {
  let state = { scene: 1, yearStart: 2020, yearEnd: 2023, selectedCountry: null };
  let isoLookup = {};

  // Load data
  const data = await d3.csv("data/covid_yearly.csv", d3.autoType);
  const worldTopo = await d3.json("data/countries-110m.json");

  const isoRows = await d3.csv("data/iso_lookup.csv");
  isoRows.forEach(function(row) {
    const paddedId = String(row.numeric_id).padStart(3, "0");
    isoLookup[paddedId] = row.ISO3;
  });

  console.log("Data loaded:", data.length, "rows");

  // Initial render
  render();

  // Add event listeners to buttons
  d3.select("#nextBtn").on("click", function() {
    state.scene = Math.min(3, state.scene + 1);
    render();
  });

  d3.select("#prevBtn").on("click", function() {
    state.scene = Math.max(1, state.scene - 1);
    render();
  });

  d3.select("#yearStartSlider").on("input", function() {
    state.yearStart = +this.value;
    if (state.yearEnd < state.yearStart) state.yearEnd = state.yearStart;
    render();
  });

  d3.select("#yearEndSlider").on("input", function() {
    state.yearEnd = +this.value;
    if (state.yearStart > state.yearEnd) state.yearStart = state.yearEnd;
    render();
  });

  d3.select("#countrySelect").on("change", function() {
    state.selectedCountry = this.value || null;
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

  // Keeps the header buttons/slider in sync with state
  function updateControls() {
    d3.select("#scene-indicator").text("Scene " + state.scene + " of 3");
    d3.select("#prevBtn").property("disabled", state.scene === 1);
    d3.select("#nextBtn").property("disabled", state.scene === 3);

    d3.select("#year-control").style("display", state.scene === 3 ? "inline" : "none");
    d3.select("#country-control").style("display", state.scene === 3 ? "inline" : "none");
    d3.select("#yearStartSlider").property("value", state.yearStart);
    d3.select("#yearStartLabel").text(state.yearStart);
    d3.select("#yearEndSlider").property("value", state.yearEnd);
    d3.select("#yearEndLabel").text(state.yearEnd);
  }

  function drawScatter() {
    console.log("Drawing  scene 1 scatterplot for all years"); // Debug log

    d3.select("#scene-title").text("Scene 1 — Global Fatality Trend: Deaths vs. Cases by Country Median Age 2020 - 2023");
    d3.select("#scene-subtitle").text("This visualization shows the global trend of fatality rate by median age group per country. As you can see, dots representing countries with higher median age groups gravitate towards the higher fatality rate quadrant (upper right) while low median age groups gravitate towards the lower fatality rate quadrant (lower left).  Each dot is a country. Color = Country median age. Both axes are log scale. ");

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
      return {
        Country: country,
        "Cases per 100k": d3.mean(rows, d => d["Cases per 100k"]),
        "Deaths per 100k": d3.mean(rows, d => d["Deaths per 100k"]),
        "Age Group": rows[rows.length - 1]["Age Group"] // latest year's bucket
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
      .range(["#fee08b", "#ffa500", "#ff6600", "#cc0000"]);

    // Axes — log scale
    g.append("g")
      .attr("transform", "translate(0," + innerHeight + ")")
      .call(d3.axisBottom(x).ticks(6, "~s"))
      .selectAll(".tick")
      .filter(function() { return d3.select(this).select("text").text() === ""; })
      .remove();

    g.append("g")
      .call(d3.axisLeft(y).ticks(6, "~s"))
      .selectAll(".tick")
      .filter(function() { return d3.select(this).select("text").text() === ""; })
      .remove();

    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 45)
      .attr("text-anchor", "middle")
      .text("Cases per 100,000 population (log)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .text("Deaths per 100,000 population (log)");

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
          label: "Oldest countries cluster at the top right: 336 deaths per 100k in 2021.",
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
          label: "Youngest countries sit near the bottom left: under 1 death per 100k.",
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
    console.log("Drawing bars"); // Debugging

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
      .range(["#fee08b", "#ffa500", "#ff6600", "#cc0000"]);

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
      .text("Country median age");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .text("Avg deaths per 100,000 population (2020–2023)");

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

  function drawMap() {
    console.log("Drawing map for", state.yearStart, "-", state.yearEnd); // Debugging

    d3.select("#scene-title").text("Scene 3 — Explore the World: COVID-19 by Country and Year");
    d3.select("#scene-subtitle").text("Now explore for yourself. Countries are colored by median-age. Drag the year sliders to change the year range, then click a country on the map or pick one from the dropdown to view/pin its details.");

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
      .range(["#fee08b", "#ffa500", "#ff6600", "#cc0000"]);
    const noDataColor = "#e0e0e0";

    // Filter to the selected year range, then average each country's rows in that range
    const rangeRows = data.filter(function(d) {
      return d.Year >= state.yearStart && d.Year <= state.yearEnd;
    });

    const byCountry = d3.group(rangeRows, d => d.Country);

    const yearRows = Array.from(byCountry, function([country, rows]) {
      return {
        Country: country,
        ISO3: rows[0].ISO3,
        "Median Age": d3.mean(rows, d => d["Median Age"]),
        "Age Group": rows[rows.length - 1]["Age Group"], // latest year's bucket
        "Cases per 100k": d3.mean(rows, d => d["Cases per 100k"]),
        "Deaths per 100k": d3.mean(rows, d => d["Deaths per 100k"]),
        Cases: d3.mean(rows, d => d.Cases),
        Deaths: d3.mean(rows, d => d.Deaths),
        Population: d3.mean(rows, d => d.Population)
      };
    });

    const yearText = state.yearStart === state.yearEnd
      ? state.yearStart
      : state.yearStart + "–" + state.yearEnd;

    const rowsByIso = {};
    yearRows.forEach(function(d) {
      rowsByIso[d.ISO3] = d;
    });

    // TopoJSON feature ids are 3-digit UN numeric codes, map them to ISO3 through isoLookup
    function isoForFeature(feature) {
      if (feature.properties.name === "Kosovo") {
        return "XKS";
      }
      const paddedId = String(feature.id).padStart(3, "0");
      return isoLookup[paddedId];
    }

    const features = topojson.feature(worldTopo, worldTopo.objects.countries).features;
    features.forEach(function(feature) {
      feature.iso = isoForFeature(feature);
    });

    const projection = d3.geoNaturalEarth1()
      .fitSize([innerWidth, innerHeight], topojson.feature(worldTopo, worldTopo.objects.countries));

    const path = d3.geoPath().projection(projection);
    const mapBounds = path.bounds(topojson.feature(worldTopo, worldTopo.objects.countries));
    const currentTranslate = projection.translate();
    projection.translate([
      currentTranslate[0] - mapBounds[0][0],
      currentTranslate[1] - mapBounds[0][1]
    ]);

    // Country pinned via the dropdown
    const pinnedRow = state.selectedCountry
      ? yearRows.find(function(d) { return d.Country === state.selectedCountry; })
      : null;

    const countries = g.append("g")
      .attr("class", "countries")
      .selectAll("path")
      .data(features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill", function(feature) {
        const row = rowsByIso[feature.iso];
        return row ? color(row["Age Group"]) : noDataColor;
      })
      .attr("stroke", function(feature) {
        return (pinnedRow && feature.iso === pinnedRow.ISO3) ? "black" : "white";
      })
      .attr("stroke-width", function(feature) {
        return (pinnedRow && feature.iso === pinnedRow.ISO3) ? 2 : 0.5;
      })
      .style("cursor", function(feature) {
        return rowsByIso[feature.iso] ? "pointer" : "default";
      })
      .on("click", function(_, feature) {
        const row = rowsByIso[feature.iso];
        if (!row) return;

        // clicking a country pins it, same as picking it from the dropdown
        state.selectedCountry = row.Country;
        render();
      });

    if (pinnedRow) {
      countries.filter(function(feature) {
        return feature.iso === pinnedRow.ISO3;
      }).raise();
    }

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

    const noDataRow = legend.append("g")
      .attr("transform", "translate(0, " + (22 + ageGroups.length * 22) + ")");

    noDataRow.append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("fill", noDataColor);

    noDataRow.append("text")
      .attr("x", 20)
      .attr("y", 12)
      .style("font-size", "12px")
      .text("No data");

    // Dropdown — repopulated on every draw, keeping the current selection
    const countryNames = Array.from(new Set(data.map(function(d) { return d.Country; }))).sort();

    const select = d3.select("#countrySelect");
    select.selectAll("option").remove();
    select.append("option").attr("value", "").text("— select —");
    countryNames.forEach(function(name) {
      select.append("option").attr("value", name).text(name);
    });
    select.property("value", state.selectedCountry || "");

    // Pinned details panel — persists below the legend, not hover-dependent
    if (pinnedRow) {
      const panelTop = 22 + (ageGroups.length + 1) * 22 + 20;

      const panel = legend.append("g")
        .attr("class", "pinned-panel")
        .attr("transform", "translate(0, " + panelTop + ")");

      panel.append("text")
        .attr("x", 0)
        .attr("y", 0)
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .text(pinnedRow.Country);

      const panelLines = [
        "Year: " + yearText,
        "Median age: " + d3.format(".1f")(pinnedRow["Median Age"]),
        "Age group: " + pinnedRow["Age Group"],
        "Cases per 100k: " + d3.format(",.1f")(pinnedRow["Cases per 100k"]),
        "Deaths per 100k: " + d3.format(",.2f")(pinnedRow["Deaths per 100k"]),
        "Total cases: " + d3.format(",.0f")(pinnedRow.Cases),
        "Total deaths: " + d3.format(",.0f")(pinnedRow.Deaths),
        "Population: " + d3.format(",.0f")(pinnedRow.Population)
      ];

      panelLines.forEach(function(line, i) {
        panel.append("text")
          .attr("x", 0)
          .attr("y", 18 + i * 16)
          .style("font-size", "10px")
          .text(line);
      });
    }
  }
}
