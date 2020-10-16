/*
 *  Shaper Origin SVG exporter for QCAD
 *
 *  Copyright (C) 2020 Weston Schmidt
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 *  SVG documentation based on what Shaper has provided:
 *
 *  Colors
 *      Blue:   #0068FF
 *      Grey:   #7F7F7F
 *      Black:  #000000
 *      White:  #FFFFFF
 *
 *  SVG stroke (border line) & fill (field) color meanings
 *
 *  Fill  | Stroke | Meaning to Shaper Origin
 *  ------+--------+-------------------------
 *  Black | Black  | Exterior cut (on the outside of the stroke ignoring the width)
 *  White | Black  | Interior cut (on the inside of the stroke ignoring the width)
 *  none  | Grey   | On-Line cut (on the middle of the stroke ignoring the width)
 *  Grey  | none   | Pocketing cut
 *  Blue  | Blue   | Guide overlay shapes
 */


/**
 * Provides the details about if an entity should be exported and how it should
 * be exported.
 *
 * @param entity REntity entity to inspect
 *
 * @return the struct with type & style either valid (export) or undefined (do
 *         not export)
 */
function getExportDetails(entity, props) {
    var exterior    = { 'type': "exterior", 'style': sprintf("fill:#000000;stroke:#000000;stroke-width:%f", props.stroke), 'style_alt': "" };
    var interior    = { 'type': "interior", 'style': sprintf("fill:#ffffff;stroke:#000000;stroke-width:%f", props.stroke), 'style_alt': "" };
    var online      = { 'type': "online",   'style': sprintf("fill:none;   stroke:#7f7f7f;stroke-width:%f", props.stroke), 'style_alt': "" };
    var guide       = { 'type': "guide",    'style': sprintf("fill:none;   stroke:#0068ff;stroke-width:%f", props.stroke), 'style_alt': sprintf("fill:#0068ff;stroke:#0068ff;stroke-width:%f", props.stroke) };
    var guideFilled = { 'type': "guide",    'style': sprintf("fill:#0068ff;stroke:#0068ff;stroke-width:%f", props.stroke), 'style_alt': "" };
    var pocket      = { 'type': "pocket",   'style':         "fill:#7f7f7f;stroke:none",                                   'style_alt': "" };
    var skip        = { 'type': undefined,  'style': undefined,                                                            'style_alt': undefined };

    var type = entity.getType();
    var layer = entity.getLayerName();

    // Only accept an object that we can reasonably render
    switch( type ) {
        case RS.EntityLine:
        case RS.EntityPolyline:
        case RS.EntityArc:
        case RS.EntityCircle:
        case RS.EntityEllipse:
        case RS.EntityTextBased:
        case RS.EntityText:
        case RS.EntityDimension:
        case RS.EntityDimLinear:
        case RS.EntityDimAligned:
        case RS.EntityDimRotated:
        case RS.EntityDimRadial:
        case RS.EntityDimDiametric:
        case RS.EntityDimAngular:
        case RS.EntityDimAngular2L:
        case RS.EntityDimAngular3P:
        case RS.EntityDimArcLength:
        case RS.EntityDimOrdinate:
        case RS.EntityHatch:
        case RS.EntityLeader:
        case RS.EntitySpline:
            break;

        default:
            EAction.handleUserMessage(qsTr("RS Type: Unknown: %1\n").arg(type));
            return skip;
    }


    if (props.guide === layer) {
        if (RS.EntityHatch == type) {
            return guideFilled;
        }

        return guide;
    }

    if (props.online === layer) {
        return online;
    }


    if (type == RS.EntityHatch) {
        if (props.exterior === layer) {
            return exterior;
        } else if (props.interior === layer) {
            return interior;
        } else if (props.pocket === layer) {
            return pocket;
        }
    }

    return skip;
}


/**
 *  Determines the correct large and sweep values for the SVG based on the
 *  object geometry.
 *
 *  @param entity the entity to examine
 *
 *  @return an object with 'sweep' and 'large' elements populated
 */
function calcLargeSweep( entity ) {
    var rv = { 'sweep': 1,
               'large': 0 };

    var angle = RMath.rad2deg(entity.getSweep());

    if (angle < 0.0) { // Clockwise
        rv.sweep = 0;
        angle *= -1;
    }
    if (180 < angle) {
        rv.large = 1;
    }

    return rv;
}


/**
 * Determine the bounding box and valid objects to render
 *
 * @param doc       the RDocument to traverse
 * @param regex     regular expression to evaluate the layer names against for
 *                  filtering
 * @param props     various properties:
 *
 * @return the struct with bb & entities set to the valid bounding box and list
 *         of entities {entity: "foo", type: "interior", style: "foo" } to render
 */
function filterAndBound(doc, regex, props) {
    var layerNames = doc.getLayerNames();

    var re = new RegExp(regex);

    var rv = { 'bb': new RBox(), 'list': [] };

    var interior = [];
    var exterior = [];
    var online = [];
    var pocket = [];
    var guide = [];


    for(var layer = 0; layer < layerNames.length; layer++) {
        if(layerNames[layer].toLocaleLowerCase().match(re)) {
            // On an eligible layer
            var layerId = doc.getLayerId(layerNames[layer]);
            var entityIds = doc.queryLayerEntities(layerId);

            for( var entityIndex = 0; entityIndex < entityIds.length; entityIndex++) {
                var id = entityIds[entityIndex];
                var entity = doc.queryEntity(id);

                var details = getExportDetails(entity, props);

                if (undefined == details.type) {
                    continue;
                }

                var tmp = { 'id': id,
                            'type': details.type,
                            'style': details.style,
                            'style_alt': details.style_alt };

                if (details.type === "interior") {
                    interior.push(tmp);
                } else if (details.type === "exterior") {
                    exterior.push(tmp);
                } else if (details.type === "online") {
                    online.push(tmp);
                } else if (details.type === "pocket") {
                    pocket.push(tmp);
                } else if (details.type === "guide") {
                    guide.push(tmp);
                }

                rv.bb.growToInclude(entity.getBoundingBox());
            }
        }
    }

    /* Order the SVG build */
    var i;
    for( i = 0; i < exterior.length; i++ ) {
        rv.list.push(exterior[i]);
    }
    for( i = 0; i < interior.length; i++ ) {
        rv.list.push(interior[i]);
    }
    for( i = 0; i < pocket.length; i++ ) {
        rv.list.push(pocket[i]);
    }
    for( i = 0; i < online.length; i++ ) {
        rv.list.push(online[i]);
    }
    for( i = 0; i < guide.length; i++ ) {
        rv.list.push(guide[i]);
    }

    return rv;
}


/**
 * Exports the given RDocument (doc) to a Shaper Origin focused SVG.
 *
 * @param doc RDocument document
 * @param fileName File name for exported SVG.
 * @param props Various properties
 */
function exportShaper(doc, props) {

    var file = new QFile(props.filename);
    if (!file.open(QIODevice.WriteOnly)) {
        EAction.handleUserMessage(qsTr("unable to open: %1\n").arg(props.filename));
        return "File open error.";
    }

    var ts = new QTextStream(file);
    ts.setCodec("UTF-8");

    var selection = filterAndBound(doc, ".*shaper.*", props);

    var output = [];
    var units = "mm";

    if (RS.Inch == props.units) {
        units = "in";
    }

    var c1 = selection.bb.getCorner1();
    var c2 = selection.bb.getCorner2();
    var width = selection.bb.getWidth() + props.extra;
    var height = selection.bb.getHeight() + props.extra;
    var docUnit = doc.getUnit();
    var svgUnit = props.units;

    output.push( "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" );
    // Make the canvas a bit larger to give some latitude for line widths and the like.
    // Add a y inversion transform and viewbox so translation is not needed
    var tmp = sprintf( "<svg width=\"%.8f%s\" height=\"%.8f%s\" viewBox=\"%.8f %.8f %.8f %.8f\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">",
                       RUnit.convert(width, docUnit, svgUnit), units,
                       RUnit.convert(height, docUnit, svgUnit), units,
                       RUnit.convert((c1.getX() - props.extra/2), docUnit, svgUnit),
                       RUnit.convert((0 - (c2.getY() + props.extra/2)), docUnit, svgUnit),
                       RUnit.convert(width, docUnit, svgUnit),
                       RUnit.convert(height, docUnit, svgUnit) );
    output.push(tmp);
    tmp = sprintf( "<g transform=\"scale(%.8f,-%.8f)\">",
                       RUnit.convert(1, docUnit, svgUnit),
                       RUnit.convert(1, docUnit, svgUnit) );
    output.push( tmp );

    var got = renderSelection( doc, selection );
    for (var i = 0; i < got.length; i++ ) {
        output.push(got[i]);
    }

    output.push( "</g>" );
    output.push( "</svg>" );

    for (var i = 0; i < output.length; i++ ) {
        ts.writeString( output[i] );
        ts.writeString( "\n" );
        //EAction.handleUserMessage(qsTr("%1\n").arg(output[i]));
    }
    file.close();

    return undefined
};


/**
 *  Render the selection of entities
 *
 *  @param doc RDocument document
 *  @param sel the selected entities to render
 *
 *  @return an array of strings representing the entities rendered
 */
function renderSelection( doc, sel ) {

    var output = [];

    for (var i = 0; i < sel.list.length; i++ ) {
        var e = sel.list[i];
        var entity = doc.queryEntity(e.id);
        var tmp = "";

        switch (entity.getType()) {
            case RS.EntityCircle:
                var center = entity.getCenter();

                tmp = sprintf( "<circle cx=\"%.8f\" cy=\"%.8f\" r=\"%.8f\" style=\"%s\"/>", 
                                    center.getX(), center.getY(), entity.getRadius(), e.style);
                break;

            case RS.EntityLine:
                var shapes = entity.getShapes();
                for (var j = 0; j < shapes.length; j++) {
                    tmp = tmp.concat( renderPath(shapes[j], e.style, renderLinePath) );
                }
                break;

            case RS.EntityArc:
                tmp = renderPath( entity.castToShape(), e.style, renderArcPath );
                break;

            case RS.EntityEllipse:
                tmp = renderPath( entity.castToShape(), e.style, renderEllipsePath );
                break;

            case RS.EntitySpline:
                tmp = renderPath( entity.castToShape(), e.style, renderSplinePath );
                break;

            case RS.EntityPolyline:
                tmp = renderPath( entity.castToShape(), e.style, renderPolylinePath );
                break;

            case RS.EntityHatch:
                tmp = renderHatchPath( entity, e.style );
                break;

            case RS.EntityDimension:
            case RS.EntityDimAligned:	
            case RS.EntityDimAngular:	
            case RS.EntityDimAngular2L:	
            case RS.EntityDimAngular3P:
            case RS.EntityDimArcLength:
            case RS.EntityDimDiametric:
            case RS.EntityDimension:
            case RS.EntityDimLinear:
            case RS.EntityDimOrdinate:
            case RS.EntityDimRadial:
            case RS.EntityDimRotated:
                var shapes = entity.getShapes();
                for (var j = 0; j < shapes.length; j++) {
                    // To account for filled triangle arrows, use the alternate style (filled)
                    tmp = tmp.concat( renderPath( shapes[j], e.style_alt, renderUnknownShapePath) );
                }

                var text = entity.getTextData().getShapes();
                for (var j = 0; j < text.length; j++) {
                    tmp = tmp.concat( renderPath( text[j], e.style, renderUnknownShapePath) );
                }
                break;

            case RS.EntityText:
                var shapes = entity.getShapes();
                for (var j = 0; j < shapes.length; j++) {
                    tmp = tmp.concat( renderPath( shapes[j], e.style, renderUnknownShapePath) );
                }
                break;


            default:
                EAction.handleUserMessage(qsTr("RS.Unknown: %1\n").arg(entity.getType()));
        }

        output.push(tmp);
    }

    return output;
}


/**
 *  Renders the wrapper path, style and calls the function for rendering the
 *  actual entity.
 *
 *  @param entity the entity to render
 *  @param style  the line style data to apply
 *  @param fn     the function needed to render the entity internals
 *
 *  @return the rendered SVG <path .../> object
 */
function renderPath( entity, style, fn ) {
    var start = entity.getStartPoint();

    var path = sprintf( "<path d=\"M %.8f,%.8f ", start.getX(), start.getY() );

    path = path.concat( fn(entity) );

    return path.concat( sprintf("\" style=\"%s\"/>", style) );
}


/**
 *  Renders the wrapper path, style and calls the function for rendering the
 *  actual entity array.
 *
 *  @param list   the list to render
 *  @param style  the line style data to apply
 *  @param fn     the function needed to render the list internals
 *
 *  @return the rendered SVG <path .../> object
 */
function renderPathArray( list, style, fn ) {
    var start = list[0].getStartPoint();

    var path = sprintf( "<path d=\"M%.8f,%.8f ", start.getX(), start.getY() );

    path = path.concat( fn(list) );

    return path.concat( sprintf("\" style=\"%s\"/>", style) );
}


/**
 *  Render the specified line shape.
 *
 *  @param line the line to render
 *
 *  @return the path describing the line
 */
function renderLinePath( line ) {
    var p2 = line.getEndPoint();

    return sprintf( " L%.8f,%.8f ", p2.getX(), p2.getY() );
}


/**
 *  Render the specified arc shape.
 *
 *  @param arc the arc to render
 *
 *  @return the path describing the arc
 */
function renderArcPath( arc ) {
    var dir = calcLargeSweep( arc );
    var r = arc.getRadius();

    if ((2 * Math.PI - RS.AngleTolerance)<= arc.getSweep()) {
        var p1 = arc.getPointAtAngle(0);
        var p2 = arc.getPointAtAngle(Math.PI);
        var a1 = printAbsArcPath( r, r, 0, dir.large, dir.sweep, p2.getX(), p2.getY() );
        var a2 = printAbsArcPath( r, r, 0, dir.large, dir.sweep, p1.getX(), p1.getY() );
        a2 = a2.concat( " Z " );
        return a1.concat( a2 );
    }

    var p2 = arc.getEndPoint();

    return printAbsArcPath( r, r, 0, dir.large, dir.sweep, p2.getX(), p2.getY() );
}


/**
 *  Render the specified ellipse shape.
 *
 *  @param ellipse the ellipse to render
 *
 *  @return the path describing the ellipse
 */
function renderEllipsePath( ellipse ) {
    var dir = calcLargeSweep( ellipse );
    var major = ellipse.getMajorRadius();
    var minor = ellipse.getMinorRadius();
    var angle = RMath.rad2deg(ellipse.getAngle());

    if (ellipse.isFullEllipse()) {
        var p1 = ellipse.getPointAt(0);
        var p2 = ellipse.getPointAt(Math.PI);

        var a1 = printAbsArcPath( major, minor, angle, dir.large, dir.sweep, p2.getX(), p2.getY() );
        var a2 = printAbsArcPath( major, minor, angle, dir.large, dir.sweep, p1.getX(), p1.getY() );
        a2 = a2.concat( " Z " );
        return a1.concat( a2 );
    }

    var p2 = ellipse.getEndPoint();
    return printAbsArcPath( major, minor, angle, dir.large, dir.sweep, p2.getX(), p2.getY() );
}


/**
 *  Render the specified spline shape.
 *
 *  @param spline the spline to render
 *
 *  @return the path describing the spline
 */
function renderSplinePath( spline ) {
    var beziers = spline.getBezierSegments();
    var path = ""

    for (var b = 0; b < beziers.length; b++) {
        var bezier = beziers[b];
        var cp = bezier.getControlPoints();

        if (2 == spline.getDegree()) {
            path = path.concat( sprintf( " Q%.8f,%.8f %.8f,%.8f ",
                                        cp[1].getX(), cp[1].getY(),
                                        cp[2].getX(), cp[2].getY()));
        } else {
            path = path.concat( sprintf( " C%.8f,%.8f %.8f,%.8f %.8f,%.8f ",
                                        cp[1].getX(), cp[1].getY(),
                                        cp[2].getX(), cp[2].getY(),
                                        cp[3].getX(), cp[3].getY()));
        }
    }

    return path;
}


/**
 *  Render the specified polyline shape.
 *
 *  @param pl the polyline to render
 *
 *  @return the path describing the polyline
 */
function renderPolylinePath( pl ) {
    var path = "";
    var count = pl.countSegments();

    var shapes = [];
    for (var i = 0; i < count; i++) {
        shapes[0] = pl.getSegmentAt(i);
        path = path.concat(renderArrayofShapesPath(shapes) );
    }

    return path;
}


/**
 *  Render the specified hatch shape.
 *
 *  @param pl the hatch to render
 *
 *  @return the path describing the hatch
 */
function renderHatchPath( hatch, style ) {
    var hatchData = hatch.getData();
    var count = hatchData.getLoopCount();
    var rv = "";
    for (var i = 0; i < count; i++) {
        var shapes = hatchData.getLoopBoundary(i);
        rv = rv.concat( renderPathArray(shapes, style, renderArrayofShapesPath) );
    }
    return rv;
}


/**
 *  Render the specified triangle shape.
 *
 *  @param triangle the triangle to render
 *
 *  @return the path describing the triangle
 */
function renderTrianglePath( triangle ) {
    var p = triangle.getEndPoints();

    return sprintf( " M%.8f,%.8f L%.8f,%.8f L%.8f,%.8f Z ",
                    p[0].getX(), p[0].getY(),
                    p[1].getX(), p[1].getY(),
                    p[2].getX(), p[2].getY() );
}


/**
 *  Render an array of arbitrary shapes into a path.
 *
 *  @param list the array of shapes to render
 *
 *  @return the path describing the collection of shapes
 */
function renderArrayofShapesPath( list ) {
    var path = "";

    for (var i = 0; i < list.length; i++) {
        path = path.concat( renderUnknownShapePath( list[i] ) );
    }

    return path;
}


/**
 *  Render an arbitrary/unknown shape type into a path
 *
 *  @param the shape to render
 *
 *  @return the path describing the shap
 */
function renderUnknownShapePath( shape ) {
    switch (shape.getShapeType()) {
        case RShape.Line:       // 1
            //EAction.handleUserMessage(qsTr("RShape.Line\n"));
            return renderLinePath( shape );

        case RShape.Arc:        // 2
            //EAction.handleUserMessage(qsTr("RShape.Arc\n"));
            return renderArcPath( shape );

        case RShape.Ellipse:    // 4
            //EAction.handleUserMessage(qsTr("RShape.Ellipse\n"));
            return renderEllipsePath( shape );

        case RShape.Polyline:   // 5
            //EAction.handleUserMessage(qsTr("RShape.Polyline\n"));
            return renderPolylinePath( shape );

        case RShape.Spline:     // 6
            //EAction.handleUserMessage(qsTr("RShape.Spline\n"));
            return renderSplinePath( shape );

        case RShape.Triangle:   //  7
            //EAction.handleUserMessage(qsTr("RShape.Triangle\n"));
            return renderTrianglePath( shape );

        //case RShape.Circle:   //  3
        default:
            EAction.handleUserMessage(qsTr("RShape.Unknown: %1\n").arg(shape.getShapeType()));
    }

    return "";
}


/**
 *  Helper function that consistently outputs the arc path instructions.
 *
 *  @param rx    the svg parameter to encode
 *  @param ry    the svg parameter to encode
 *  @param angle the svg parameter to encode
 *  @param large the svg parameter to encode
 *  @param sweep the svg parameter to encode
 *  @param x     the svg parameter to encode
 *  @param y     the svg parameter to encode
 *
 *  @return the encoded string
 */
function printAbsArcPath( rx, ry, angle, large, sweep, x, y ) {
    return sprintf( " A%.8f,%.8f %.8f %d %d %.8f,%.8f ",
                    rx, ry, angle, large, sweep, x, y );
}
