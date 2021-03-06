function showSbgn(data){
	d3.selectAll("#bivesGraph").selectAll("svg").remove();
	$('#graphTab').show();
	$('#donwload').show();

	if(data == "" || data == undefined) {
		$('#graphTab').hide();
		return;
	}
	var obj = JSON.parse(data);

	var currentZoom = 1;
	// register click-listeners to the download button
    $("#download").click (function (){download (obj);});

	var width = 1000,
		height = 800,
		size = (width - 50) / 10 ;
		marker = width / 100;

	var color = d3.scale.category20();

	var force = d3.layout.force()
		.charge(-400)
		.linkDistance(100)
		.gravity(0.2)
		.size([width, height]);

	//zoom the whole svg
	var zoom = d3.behavior.zoom()
    .scaleExtent([0.1, 10])
    .on("zoom", zoomed);

	function zoomed() {
		container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");

		tick();
	}

	var svg = d3.select("#bivesGraph").append("svg")
		.attr("id", 'bivesGraphSvg')
		.attr("width", width)
		.attr("height", height)
		.call(zoom);

	var container = svg.append("g");

	var defs = appendDefs(svg); //define arrowheads: see appendDefs.js

	var edges = [];
	var compartments = [];
	var focis= [
		[{x:width/2,y:height/2}],
		[{x:0,y:height/2},{x:width,y:height/2}],
		[{x:width/2,y:0},{x:0,y:height},{x:width, y:height}],
		[{x:0,y:0},{x:width,y:0},{x:0, y:height},{x:width,y:height}],
		[{x:0,y:0},{x:width,y:0},{x:width/2, y:height/2},{x:0,y:height},{x:width,y:height}]
	]
	var nodeById = d3.map();

	  obj.nodes.forEach(function(node) {

		var add = true;
		for(var i=0; i < compartments.length; i++){
			if(compartments[i].id == node.compartment){
				compartments[i].sum +=1;
				add = false;
			}
		}

		if(add){
			compartments.push({id: node.compartment, sum: 1});
		}
		nodeById.set(node.id, node);
	  });

	  //console.log(compartments);
	  //console.log(nodeById);



	  obj.links.forEach(function(link) {
		link.source = nodeById.get(link.source);
		link.target = nodeById.get(link.target);
	  });

	force
		.nodes(obj.nodes)
		.links(obj.links)
		.start();

	var drag = force.drag()
    .on("dragstart", dragstart);

	function dragstart(d) {
		d3.event.sourceEvent.stopPropagation();
		d3.select(this).classed("fixed", d.fixed = true);
	}

	var dragCompartment = d3.behavior.drag()
		.on("dragstart", function() {force.start(); d3.event.sourceEvent.stopPropagation();})
		.on("drag", function(d, i){

			var key = d.key;
			var selection = d3.selectAll("#bivesGraphSvg").selectAll("g.node")
				.filter(function(d){return d.compartment == key});

			selection.each(
					function(d){
						d3.select(this).classed("fixed", d.fixed = true);
						d.x = d.x + d3.event.dx;
						d.y = d.y + d3.event.dy;
						d3.select(this).attr("transform", function(d,i){
							return "translate(" + [ d.x,d.y ] + ")"
						})
						x=d.x; y=d.y;
						d.px=d.x; d.py=d.y;
					}
				);
			tick();
		})

	var nested_data = d3.nest()
		.key(function(d) { return d.compartment; })
		.entries(obj.nodes);

	  var link = container.selectAll(".link")
		  .data(obj.links)
		.enter().append("path")
		  .attr("marker-end", function(d) {
				var elementClass;
				return "url(#" + sboSwitchArc(d.class) + "" + d.bivesClass + ")";
			})
		  .attr("id", function(d) {return d.id})
		  .attr("class", function(d) { return "link " + d.bivesClass;})
		  .style("stroke-width", 1)
		  .style("fill", "none")
		  .style("stroke", function(d) { return getColor(d.bivesClass);})

	function getColor(bivesColor){
		switch (bivesColor){
			case 'insert': return "green"; break;
			case 'delete': return "red"; break;
			case 'move': return "blue"; break;
			case 'update': return "orange"; break;
			default: return "black";
		}
	}

	function compartmentFlex(id){
		//find min and max values of contained nodes
		var xMin=Infinity, xMax=-Infinity, yMin=Infinity, yMax=-Infinity
		nested_data.forEach(function(d){
			if(d.key == id){
				d.values.forEach(function(e){
					var element = d3.select("#"+e.id).node();
					var halfElementWidth = 0;
					var halfElementHeight = 0;
					if(element != null){
						var boundingClientRect = element.getBoundingClientRect();
						halfElementWidth = boundingClientRect.width/2/currentZoom;
						halfElementHeight = boundingClientRect.height/2/currentZoom;
					}

					xMin = Math.min(xMin, e.x-halfElementWidth);
					xMax = Math.max(xMax, e.x+halfElementWidth);
					yMin = Math.min(yMin, e.y-halfElementHeight);
					yMax = Math.max(yMax, e.y+halfElementHeight);
				})
			}
		});
		if(xMin==Infinity)  return;
		var x= (-xMin+xMax)/3;
		var y= (yMin+yMax)*0.05;
		return "M " + xMin + " " + yMin +
		" Q " + (xMin+x/2) + " " + (yMin-8) + " " + (xMin+x) + " " +(yMin-8) +
		" H " + (xMin + 2*x) +
		" Q " + (xMax-x/2) + " " + (yMin-8) + " " + xMax + " " +(yMin) +
		" V " + yMax +
		" Q " + (xMax-x/2) + " " + (yMax+8) + " " + (xMax-x) + " " +(yMax+8) +
		" H " + (xMin + x) +
		" Q " + (xMin+x/2) + " " + (yMax+8) + " " + (xMin) + " " +(yMax) +
		" z ";
	}

	  var node = container.selectAll(".node")
		  .data(obj.nodes.filter(function(d) { return sboSwitch(d.class) != "compartment"}))
		.enter().append("g")
			.attr("class", function(d) {return "node " + sboSwitch(d.class);})
			.attr("compartment", function(d) {return d.compartment;} )
			.attr("fill", function(d) { if(d.class != "SBO:0000290") return "white"; if(sboSwitch(d.class)=='association') return black})
				.call(drag)
				;//.call(node_drag);

		node.insert("path")
		  .attr("class", function(d) { return "node " + d.bivesClass } )
		  .attr("id", function(d) {return d.id})
		  .attr("compartment", function(d) {return d.compartment})
		  .attr('d', function(d) {
			var nodeWidth = size;
			if(d.label != null && d.class != "SBO:0000290") {nodeWidth = d.label.length * 7; if(nodeWidth < 35) nodeWidth = 35;} // biggest size of a Char is ca. 9
			return getSymbol(d.class, nodeWidth || size);
		  });

		node.append("text")
		  .style("text-anchor", "middle")
		  .style("stroke-width", "0px")
		  .style("fill", "black")
		  .style("font-size", "12px")
		  .attr("id", function(d) {return d.id + "-text";})
		  .attr('dy', "0.25em")
		  .each(function (d) {
				if(d.label == null) return;
				var lines = d.label.split("_ _");
				for(var i=0; i<lines.length; i++){
					d3.select(this)
						.append("tspan")
						.attr("y", function(d) {return (-(lines.length-1))*8+i*18 })
						.attr("x", "0")
						.text(lines[i]);
				}
			  });

	var compartment = container.selectAll(".compartment")
		.data(nested_data)
		//.attr("d", compartmentPath)
	  .enter().insert("g", ":first-child")
		.filter(function(d) { return d.key != "null"})
		.attr("class", "compartment")
		.attr("label", function(d) {return nodeById.get(d.key).label;} )
		.attr("id", function(d) {return d.key})

	compartment.append("path")
		.style("fill", "steelblue")
		.style("fill-opacity", "0.2")
		.style("stroke","black")
		.style("stroke-width", "2px")
		.attr("d", function(d) {return compartmentFlex(d.label)})
		.call(dragCompartment);

	compartment.append("text")
		  .style("text-anchor", "middle")
		  .style("stroke-width", "0px")
		  .style("fill", "black")
		  .style("font-size", "12px")
		  .attr("id", function(d) {return d.key + "-text";})
		  .attr('dy', "0.25em")
		  .attr("transform", function(d) {return compartmentText(d.key)}) //just a compartment hack
		  //.attr('x', function(d) { if(d.class == "SBO:0000290") return -100;})
		  .text(function(d) { return nodeById.get(d.key).label });



	force.on("tick", tick);

function compartmentText(key){
//find min and max values of contained nodes
		var xMin=Infinity, xMax=-Infinity, yMin=Infinity, yMax=-Infinity
		nested_data.forEach(function(d){
			if(d.key == key){
				d.values.forEach(function(e){
					var element = d3.select("#"+e.id).node();
					var halfElementWidth = 0;
					var halfElementHeight = 0;
					if(element != null){
						var boundingClientRect = element.getBoundingClientRect();
						halfElementWidth = boundingClientRect.width/2/currentZoom;
						halfElementHeight = boundingClientRect.height/2/currentZoom;
					}

					xMin = Math.min(xMin, e.x-halfElementWidth);
					xMax = Math.max(xMax, e.x+halfElementWidth);
					yMin = Math.min(yMin, e.y-halfElementHeight);
					yMax = Math.max(yMax, e.y+halfElementHeight);
				})
			}
		});
		if(xMin==Infinity)  return;
		return "translate("+(xMin+xMax)/2+", "+(yMin-16)+")";
}

	function tick() {
		//compartments
		  // Push different nodes in different directions for clustering.
/*  		var k = .1 * e.alpha;

		  // Push nodes toward their designated focus.
		nodeById.forEach(function(id, o) {
			if(sboSwitch(o.class) != "compartment"){
				if(compartments.length == 1){
					for(var j=0; j<compartments.length; j++){
						o.y += (compartments[o.id].y - o.y) * k;
						o.x += (compartments[o.id].x - o.x) * k;
					}
				}
				if(compartments.length == 2){
					for(var j=0; j<focis[compartments.length-1].length; j++){
						for(var i=0; i<compartments.length; i++){
							if(compartments[i].id == o.compartment){
								o.y += (focis[compartments.length-1][j].y - o.y) * k;
								o.x += (focis[compartments.length-1][j].x - o.x) * k;
							}
						}
					}
				}
			}
		});  */

	compartment.select("path").attr("d", function(d){
		return compartmentFlex(d.key);
	})

	compartment.select("text").attr("transform", function(d){
		return compartmentText(d.key);
	})

	//links for costum symbols and multiple links for inserts and updates

		link.attr("d", function(d){
			currentZoom = zoom.scale();
			var x1 = d.source.x,
					y1 = d.source.y,
					y2 = d.target.y,
					x2 = d.target.x;

			var element = d3.select("#"+d.target.id).node();
			var halfElementWidth = 0;
			var halfElementHeight = 0;
			if(element != null){
				var boundingClientRect = element.getBoundingClientRect();
				halfElementWidth = boundingClientRect.width/2/currentZoom;
				halfElementHeight = boundingClientRect.height/2/currentZoom;
			}



			//for process nodes: connect arcs to reactant and product ports
			elementClass = sboSwitchArc(d.class);
			if(elementClass == "consumption"){
				x2 = d.target.x - halfElementWidth;
			} else if (elementClass == "production") {
				var sourceWidth =  d3.select("#"+d.source.id).node();
				if(sourceWidth != null){
					sourceWidth = sourceWidth.getBoundingClientRect().width/2/currentZoom;
				} else sourceWidth = 0;
				x1 = d.source.x + sourceWidth;
			}

			var targetClass = sboSwitch(d.target.class);



			if((targetClass == "simple chemical" && halfElementWidth*2 <= 35.1) || targetClass == "source and sink" || ((targetClass == "dissociation" || targetClass == "association") && elementClass != "consumption")){
				var m = (d.target.y - d.source.y)/(d.target.x-d.source.x);
				var rQuad = Math.pow(halfElementWidth, 2);
				var deter = Math.sqrt(rQuad/(1+Math.pow((d.target.y-d.source.y)/(d.target.x-d.source.x), 2)));
				var xCross1 = - deter;
				var xCross2 = deter;
				var yCross1 = m*xCross1;
				var yCross2 = m*xCross2;

				if(d.target.x > d.source.x){
					if(d.target.y > d.source.y){
						x2 = d.target.x + xCross1;
						y2 =  d.target.y + yCross1;
					} else {
						x2 = d.target.x + xCross1;
						y2 =  d.target.y + yCross1;
					}
				} else {
					if(d.target.y > d.source.y){
						x2 = d.target.x + xCross2;
						y2 =  d.target.y + yCross2;
					} else {
						x2 = d.target.x + xCross2;
						y2 =  d.target.y + yCross2;
					}
				}
			} else if (targetClass == "simple chemical"){
				var m = (d.target.y - d.source.y)/(d.target.x-d.source.x);
				var rectWidth = halfElementWidth*2/currentZoom - 17.5/currentZoom;
				var rectHeight = halfElementHeight*2;
				var rectM = rectHeight / (rectWidth);
				var rectY, rectX ;

				if(Math.abs(m) > Math.abs(rectM)){
					if(d.target.y > d.source.y){
						rectY = rectHeight/2;
					} else {
						rectY = -rectHeight/2;
					}
					rectX = rectY/m;
					y2 = d.target.y - rectY;
					x2 = d.target.x - rectX;
				} else { // half circles
					var rQuad = 306.25;
					mQuad = Math.pow(m,2);

					if(d.target.x > d.source.x){
						var centerX = d.target.x -halfElementWidth*2/currentZoom - 17.5/currentZoom;
						var centerY = d.target.y;

						var sY = centerY - d.source.y;
						var sX = -centerX + d.source.x;
						var tY = 0;
						var tX = d.target.x - centerX;

						m = (tY-sY)/(tX-sX);
						mQuad = Math.pow(m,2);

						var n = (centerY-d.source.y)-m*(d.source.x-centerX);

						var nQuad = Math.pow(n,2);
						var p = (m*n)/(1+mQuad);
						var pQuad = Math.pow(p,2);
						var q = (nQuad-rQuad)/(1+mQuad)
						var deter = Math.sqrt(pQuad-q);

						var xCross = -p-deter;
						var yCross = m * xCross + n;

						x2 = centerX + xCross;
						y2 = centerY - yCross;
					} else {
						var centerX = d.target.x +halfElementWidth*2/currentZoom - 17.5/currentZoom;
						var centerY = d.target.y;

						var sY = centerY - d.source.y;
						var sX = -centerX + d.source.x;
						var tY = 0;
						var tX = d.target.x - centerX;

						m = (tY-sY)/(tX-sX);
						mQuad = Math.pow(m,2);

						var n = (centerY-d.source.y)-m*(d.source.x-centerX);

						var nQuad = Math.pow(n,2);
						var p = (m*n)/(1+mQuad);
						var pQuad = Math.pow(p,2);
						var q = (nQuad-rQuad)/(1+mQuad)
						var deter = Math.sqrt(pQuad-q);

						var xCross = -p+deter;
						var yCross = m * xCross + n;

						x2 = centerX + xCross;
						y2 = centerY - yCross;
					}

				}
			}

			if(targetClass == "complex" || targetClass == "macromolecule"){
				var m = (d.target.y - d.source.y)/(d.target.x-d.source.x);
				var rectWidth = halfElementWidth*2;
				var rectHeight = halfElementHeight*2;
				var rectM = rectHeight / rectWidth;
				var rectY, rectX ;

				if(Math.abs(m) > Math.abs(rectM)){
					if(d.target.y > d.source.y){
						rectY = rectHeight/2;
					} else {
						rectY = -rectHeight/2;
					}
					rectX = rectY/m;
					y2 = d.target.y - rectY;
					x2 = d.target.x - rectX;
				} else {
					if(d.target.x > d.source.x){
						rectX = -rectWidth/2;
					} else {
						rectX = rectWidth/2;
					}
					rectY = m*rectX;
					y2 = d.target.y + rectY;
					x2 = d.target.x + rectX;
				}
			}

			if((targetClass == "process" || targetClass == "inhibition" || targetClass == "conusmption" || targetClass == "production" || targetClass == "modulation" || targetClass == "stimulation" || targetClass == "catalysis" || targetClass == "necessary stimulation") && elementClass != "consumption" && elementClass != "production"){

				var m = (d.target.y - d.source.y)/(d.target.x-d.source.x);
				var rectWidth = halfElementWidth;
				var rectHeight = halfElementHeight*2;
				var rectM = rectHeight / rectWidth;
				var rectY, rectX ;

				if(Math.abs(m) > Math.abs(rectM)){
					if(d.target.y > d.source.y){
						rectY = rectHeight/2;
					} else {
						rectY = -rectHeight/2;
					}
					rectX = rectY/m;
					y2 = d.target.y - rectY;
					x2 = d.target.x - rectX;
				} else {
					if(d.target.x > d.source.x){
						rectX = -rectWidth/2;
					} else {
						rectX = rectWidth/2;
					}
					rectY = m*rectX;
					y2 = d.target.y + rectY;
					x2 = d.target.x + rectX;
				}
			}

			if(targetClass == "unspecified entity"){


				var m = (d.target.y - d.source.y)/(d.target.x-d.source.x);
				var w = halfElementWidth*2;
				var h = halfElementHeight*2;

				var deter = Math.sqrt( 1/( 1/Math.pow(w/2, 2) + Math.pow(m, 2)/Math.pow(h/2, 2) ) );
				var xCross1 = deter;
				var xCross2 = -deter;
				var yCross1 = m*xCross1;
				var yCross2 = m*xCross2;

				if(d.source.y < d.target.y){
					if(d.source.x < d.target.x){
						x2 = d.target.x + xCross2;
						y2 = d.target.y + yCross2;
					} else {
						x2 = d.target.x + xCross1;
						y2 = d.target.y + yCross1;
					}
				} else {
					if(d.source.x < d.target.x){
						x2 = d.target.x - xCross1;
						y2 = d.target.y - yCross1;
					} else {
						x2 = d.target.x - xCross2;
						y2 = d.target.y - yCross2;
					}
				}
			}




			var dr = Math.sqrt((x2-d.source.x) * (x2-d.source.x) + (y2-d.source.y) * (y2-d.source.y));

			//var distance = distanceHack(sboSwitch(d.target.class), size);

			switch(d.bivesClass){
		/*		case "insert": if(d.source.y < d.target.y){
					return "M" + x1 + "," + y1 + "A" + dr + "," + dr + " 0 0,1 " + (x2) + "," + y2;
				} else {
					return "M" + x1 + "," + y1 + "A" + dr + "," + dr + " 0 0,1 " + (x2) + "," + y2;
				}; break;
				case "delete": if(d.source.y < d.target.y){
					return "M" + x1 + "," + y1 + "A" + dr + "," + dr + " 0 0,0 " + (x2) + "," + y2;
				} else {
					return "M" + x1 + "," + y1 + "A" + dr + "," + dr + " 0 0,0 " + (x2) + "," + y2;
				}; break;*/
				default: return "M" + x1 + "," + y1 + "L" + (x2 + 0) + "," + y2;
			}

			//return "M" + x1 + "," + y1 + "A" + dr + "," + dr + " 0 0,1 " + x2 + "," + y2;
		});

		link.filter(function(d){return sboSwitch(d.class) != 'consumption'})
		 .attr("stroke-dasharray", function(d) {
						return this.getTotalLength() - 5;
					})

		node.attr("transform", function(d) {
				return "translate(" + d.x + "," + d.y + ")";
			});

	  };


	return obj;
}

function distanceHack(nodeClass, sized){
	var size = sized/1000;
	switch (nodeClass){
		case "process": return size*0.15 ; break;
		case "macromolecule": return size*0.5; break;
		case "source and sink": return size*0.1; break;
		case "complex": return size*0.5; break;
		case "unspecifiedentity": return size*0.5; break;
		case "simplechemical": return size*0.25; break;
		default: return size;
	}
}
