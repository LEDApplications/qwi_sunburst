// Dimensions of sunburst.
var width = 750;
var height = 600;
var radius = Math.min(width, height) / 2;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
  w: 75, h: 30, s: 3, t: 10
};

// Mapping of step names to colors.
var colors = {
  "home": "#5687d1",
  "product": "#7b615c",
  "search": "#de783b",
  "account": "#6ab975",
  "other": "#a173d1",
  "end": "#bbbbbb"
};

var color = d3.scaleOrdinal(d3.schemeCategory20c);

// Total size of all segments; we set this later, after loading the data.
var totalSize = 0; 

var vis = d3.select("#chart").append("svg:svg")
    .attr("width", width)
    .attr("height", height)
    .append("svg:g")
    .attr("id", "container")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

var partition = d3.partition()
    .size([2 * Math.PI, radius * radius]);

var arc = d3.arc()
    .startAngle(function(d) { return d.x0; })
    .endAngle(function(d) { return d.x1; })
    .innerRadius(function(d) { return Math.sqrt(d.y0); })
    .outerRadius(function(d) { return Math.sqrt(d.y1); });

// Use d3.text and d3.csvParseRows so that we do not need to have a header
// row, and can receive the csv as an array of arrays.
d3.text("label_industry.csv", function(text) {
  var indicator = 'Emp'; //EarnS, FrmJbGn, FrmJbLs
  var state = '02';
  var year = '2012';
  var quarter = '1'
  
  //var t0 = performance.now();
  
  var csv = d3.csvParseRows(text);
  var json = getQWIData(csv, indicator, state, year, quarter);

  
  $(document).ajaxStop(function () {
    //var t1 = performance.now();
    //console.log("data load took " + (t1 - t0) + " milliseconds.")
    createVisualization(json)
  });
  
});

// Main function to draw and set up the visualization, once we have the data.
function createVisualization(json) {

  // Basic setup of page elements.
  initializeBreadcrumbTrail();

  // Bounding circle underneath the sunburst, to make it easier to detect
  // when the mouse leaves the parent g.
  vis.append("svg:circle")
      .attr("r", radius)
      .style("opacity", 0);

  // Turn the data into a d3 hierarchy and calculate the sums.
  var root = d3.hierarchy(json)
      .sum(function(d) { return d.size; })
      .sort(function(a, b) { return b.value - a.value; });
  
  // For efficiency, filter nodes to keep only those large enough to see.
  var nodes = partition(root).descendants()
      .filter(function(d) {
          return (d.x1 - d.x0 > 0.005); // 0.005 radians = 0.29 degrees
      });

  var path = vis.data([json]).selectAll("path")
      .data(nodes)
      .enter().append("svg:path")
      .attr("display", function(d) { return d.depth ? null : "none"; })
      .attr("d", arc)
      .attr("fill-rule", "evenodd")
      .style("fill", function(d) { return color((d.children ? d : d.parent).data.name); })
      .style("opacity", 1)
      .on("mouseover", mouseover);

  // Add the mouseleave handler to the bounding circle.
  d3.select("#container").on("mouseleave", mouseleave);

  // Get total size of the tree = value of root node from partition.
  totalSize = path.datum().value;
 };

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(d) {

  var percentage = (100 * d.value / totalSize).toPrecision(3);
  var percentageString = percentage + "%";
  if (percentage < 0.1) {
    percentageString = "< 0.1%";
  }
  var naicscountString = d.value;

  d3.select("#percentage")
    .text(percentageString);

  d3.select("#naicslabel")
    .text(d.data.label);

  d3.select("#naicscount")
    .text(naicscountString);

  d3.select("#explanation")
      .style("visibility", "");

  var sequenceArray = d.ancestors().reverse();
  sequenceArray.shift(); // remove root node from the array
  updateBreadcrumbs(sequenceArray, percentageString, naicscountString);

  // Fade all the segments.
  d3.selectAll("path")
      .style("opacity", 0.3);

  // Then highlight only those that are an ancestor of the current segment.
  vis.selectAll("path")
      .filter(function(node) {
                return (sequenceArray.indexOf(node) >= 0);
              })
      .style("opacity", 1);
}

// Restore everything to full opacity when moving off the visualization.
function mouseleave(d) {

  // Hide the breadcrumb trail
  d3.select("#trail")
      .style("visibility", "hidden");

  // Deactivate all segments during transition.
  d3.selectAll("path").on("mouseover", null);

  // Transition each segment to full opacity and then reactivate it.
  d3.selectAll("path")
      .transition()
      .duration(1000)
      .style("opacity", 1)
      .on("end", function() {
              d3.select(this).on("mouseover", mouseover);
            });

  d3.select("#explanation")
      .style("visibility", "hidden");
}

function initializeBreadcrumbTrail() {
  // Add the svg area.
  var trail = d3.select("#sequence").append("svg:svg")
      .attr("width", width)
      .attr("height", 50)
      .attr("id", "trail");
  // Add the label at the end, for the percentage.
  trail.append("svg:text")
    .attr("id", "endlabel")
    .style("fill", "#000");
}

// Generate a string that describes the points of a breadcrumb polygon.
function breadcrumbPoints(d, i) {
  var points = [];
  points.push("0,0");
  points.push(b.w + ",0");
  points.push(b.w + b.t + "," + (b.h / 2));
  points.push(b.w + "," + b.h);
  points.push("0," + b.h);
  if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
    points.push(b.t + "," + (b.h / 2));
  }
  return points.join(" ");
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray, percentageString, naicscountString) {

  // Data join; key function combines name and depth (= position in sequence).
  var trail = d3.select("#trail")
      .selectAll("g")
      .data(nodeArray, function(d) { return d.data.name + d.depth; });

  // Remove exiting nodes.
  trail.exit().remove();

  // Add breadcrumb and label for entering nodes.
  var entering = trail.enter().append("svg:g");

  entering.append("svg:polygon")
      .attr("points", breadcrumbPoints)
      .style("fill", function(d) { return color((d.children ? d : d.parent).data.name); });

  entering.append("svg:text")
      .attr("x", (b.w + b.t) / 2)
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(function(d) { return d.data.name; });

  // Merge enter and update selections; set position for all nodes.
  entering.merge(trail).attr("transform", function(d, i) {
    return "translate(" + i * (b.w + b.s) + ", 0)";
  });

  // Now move and update the percentage at the end.
  d3.select("#trail").select("#endlabel")
      .attr("x", (nodeArray.length + 0.5) * (b.w + b.s) + 10)
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(naicscountString +" ("+ percentageString+")");

  // Make the breadcrumb trail visible, if it's hidden.
  d3.select("#trail")
      .style("visibility", "");

}

function processQWIStatusFlags(row, indicatorIndex, statusFlagIndex){
  switch(row[statusFlagIndex]) {
    case -2:
    case -1:
        return NaN;
        
    default:
        return parseInt(row[indicatorIndex])
  } 
}

function formatQWIIndustryGroups(csv){
  var fullArray = [];
  var twoDigitArray = [];
  
  csvloop:
  for (var i = 0; i < csv.length; i++) {
    var naics = csv[i][0];
    var text = csv[i][1];
    var naicsArray = naics.split("-");
    
    
    // if this is a header row or a total naics category
    for (var j = 0; j < naicsArray.length; j++){
      if (isNaN(parseInt(naicsArray[j])) || parseInt(naicsArray[j])==0) {
        continue csvloop;
      }
    }
    
    // if it's a two digit category push and reset the grouping
    if (naics.length == 2 || naics.length == 5){
      if (twoDigitArray.length != 0){
        fullArray.push(twoDigitArray);
      }
      twoDigitArray = []
    }
    
    var child = {"industry":naics,"label":text}
    twoDigitArray.push(child)
    
    // if last line in csv push to output
    if (i == csv.length-1) {
      fullArray.push(twoDigitArray);
    }
  }
  return fullArray
};

function buildHierarchyAsync(indicator, statusIndicator, urlString, industryDict){
  var dataObj = {};
  $.ajax({
    url: urlString,
    dataType: 'json',
    success: function(json) {   
      // get the locations in the returned table for the indicator and industry
      var header = json.shift()
      var industryIndex = header.indexOf('industry');
      var indicatorIndex = header.indexOf(indicator);
      var statusFlagIndex = header.indexOf(statusIndicator);

      // pluck out the parent industry and get all child industries
      var parent = {}
      var children = []
      var grandchildren = []
      json.forEach(function(row) {
        if (row[industryIndex].length == 2 || row[industryIndex].length == 5) {
          parent["name"] = row[industryIndex]
          parent["size"] = processQWIStatusFlags(row, indicatorIndex, statusFlagIndex);
          parent["label"] = industryDict[parent["name"]]
        } else if (row[industryIndex].length == 3) {
          var child = {}
          child["name"] = row[industryIndex]
          child["size"] = processQWIStatusFlags(row, indicatorIndex, statusFlagIndex);
          child["label"] = industryDict[child["name"]]
          if (!isNaN(child.size)){
            children.push(child)
          }
        } else if (row[industryIndex].length == 4) {
          var grandchild = {}
          grandchild["name"] = row[industryIndex]
          grandchild["size"] = processQWIStatusFlags(row, indicatorIndex, statusFlagIndex);
          grandchild["label"] = industryDict[grandchild["name"]]
          if (!isNaN(grandchild.size)){
            grandchildren.push(grandchild)
          }
        }
      });
      
      //format grandchildren under children structure
      children.forEach(function(child) {
        child["children"] = [];
        var grandchildTotal = 0;
        
        // add all grandchildren under the child with the same naics
        grandchildren.forEach(function(grandchild) {
          if (child.name == grandchild.name.substr(0,grandchild.name.length-1)){
            child["children"].push(grandchild)
            grandchildTotal += (isNaN(grandchild.size) ? 0 : grandchild.size);
          }
        });

        // tack on remainder if there are suppressed grandchildren
        if (grandchildTotal < child.size){
          var newgrandchild = {}
          newgrandchild["name"] = "supressed"
          newgrandchild["label"] = "supressed"
          newgrandchild["size"] = parseInt(child.size) - grandchildTotal
          child.children.push(newgrandchild)
        }
        
        // if children exist delete the known size as it's already accounted for
        // children will exist with values and any remainder will be accounted for
        if (child.children.length == 0){
          delete child.children;
        } else {
          delete child.size;
        }
      });
      
      
      // create a value in the children incase of suppression differences
      var childrenTotal = 0
      for (var i = 0; i < children.length; i++){
        for (var j = 0; j < children[i]["children"].length; j++) {
          var gchild = children[i]["children"][j]
          childrenTotal += (isNaN(gchild.size) ? 0 : gchild.size);
        }
      }

      // the full value of the parent size is maintained in thechildren

      if (childrenTotal < parent.size){
        var child = {}
        child["name"] = "supressed"
        child["label"] = "supressed"
        child["size"] = parseInt(parent.size) - childrenTotal;
        children.push(child);
      }
      
      //create object in d3 treemap format
      dataObj["size"] = parent["size"];
      dataObj["name"] = parent["name"];
      dataObj["children"] = children
      dataObj["label"] = industryDict[dataObj["name"]]

      // if children exist delete the known size as it's already accounted for
      // children will exist with values and any remainder will be accounted for
      if (dataObj.children.length == 0){
        delete dataObj.children;
      } else {
        delete dataObj.size;
      }
    }
  });
  

  return dataObj
}

function getQWIData(csv, indicator, state, year, quarter){
  var statusIndicator = "s"+indicator
  var qwiData = { "name": "naics", "children": [] }
  var apikey = "74e64b721803c1919c5a26ec275c0a1c65e9c510";
  var industryData = formatQWIIndustryGroups(csv);
  
  for (var i = 0; i < industryData.length; i++){
    var industryDict = {}
    var industry = "";
    for (var j = 0; j < industryData[i].length; j++) {
      industry += "&industry="+industryData[i][j].industry;
      industryDict[ industryData[i][j].industry ] = industryData[i][j].label;
    }
    var url = "https://api.census.gov/data/timeseries/qwi/sa?get=" + indicator+","+statusIndicator + "&for=state:" + state + "&year=" + year + "&quarter="+ quarter + industry +"&key=" + apikey
    var datareturned = buildHierarchyAsync(indicator, statusIndicator, url, industryDict)
    qwiData["children"].push(datareturned);
  }
  return qwiData
}
