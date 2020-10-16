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

include("scripts/File/File.js");
include("scripts/EAction.js");
include("scripts/Tools/arguments.js");
include("scripts/sprintf.js");
include("ShaperExportWorker.js");

function ShaperExport(guiAction) {
    EAction.call(this, guiAction);
}

ShaperExport.prototype = new EAction();

ShaperExport.includeBasePath = includeBasePath;


ShaperExport.prototype.beginEvent = function() {
    File.prototype.beginEvent.call(this);

    var fileName = undefined;
    var properties = undefined;

    if (!isNull(this.guiAction)) {
        properties = this.getProperties();
        if (isNull(properties)) {
            // properties dialog cancelled:
            this.terminate();
            return;
        }
    } else {
        this.terminate();
        return;
    }

    var err = this.exportShaper(this.getDocumentInterface(), properties);

    var appWin = EAction.getMainWindow();
    if (undefined != err) {
        print("Error: cannot save file: ", fileName);
        print("Error: ", err);
        appWin.handleUserWarning(
                qsTr("Error while generating Shaper Origin file \"%1\": %2")
                    .arg(fileName).arg(err));
    }
    else {
        appWin.handleUserMessage(
                qsTr("Shaper Origin file has been exported to \"%1\"").arg(fileName));
    }

    this.terminate();
};

ShaperExport.prototype.initLayerChoiceControl = function(doc, controlName, regex) {
    var box = this.dialog.findChild(controlName);
    WidgetFactory.initLayerCombo(box, doc);
    box.insertItem(0, "", "")

    re = new RegExp(".*"+regex+".*");

    for(box.currentIndex = box.count-1; 0 < box.currentIndex; box.currentIndex--) {
        if (box.currentText.toLocaleLowerCase().match(re)) {
            break;
        }
    }

    return box;
};

ShaperExport.prototype.getProperties = function() {

    var doc = EAction.getDocument();
    var layerNames = doc.getLayerNames();

    var appWin = EAction.getMainWindow();
    this.dialog = WidgetFactory.createDialog(ShaperExport.includeBasePath, "ShaperExport.ui", appWin);
    WidgetFactory.restoreState(this.dialog);
    var widgets = getWidgets(this.dialog);

    var unit = doc.getUnit()

    var unitCombo = this.dialog.findChild("OutputUnitsComboBox")
    unitCombo.clear()
    unitCombo.addItem(RUnit.unitToName(RS.Inch), RS.Inch);
    unitCombo.addItem(RUnit.unitToName(RS.Millimeter), RS.Millimeter);
    var strokeCombo = this.dialog.findChild("StrokeComboBox");
    var paddingCombo = this.dialog.findChild("PaddingComboBox");
    if (RUnit.isMetric(unit)) {
        unitCombo.currentIndex = 1;
        strokeCombo.setCurrentText("0.25");
        paddingCombo.setCurrentText("1");
        this.dialog.findChild("StrokeWidthLabel").setText(qsTr("Stroke width (mm):"));
        this.dialog.findChild("PaddingWidthLabel").setText(qsTr("Padding width (mm):"));
    } else {
        strokeCombo.setCurrentText("0.008");
        paddingCombo.setCurrentText("0.1");
        this.dialog.findChild("StrokeWidthLabel").setText(qsTr("Stroke width (in):"));
        this.dialog.findChild("PaddingWidthLabel").setText(qsTr("Padding width (in):"));
    }

    widgets["OutputUnitsComboBox"].currentTextChanged.connect( function(text) {
        if (RS.Inch == unitCombo.currentData) {
            /* If the defaults are used, update them as well. */
            if (widgets["StrokeComboBox"].currentText === "0.25") {
                widgets["StrokeComboBox"].setCurrentText("0.008");
            }
            if (widgets["PaddingComboBox"].currentText === "1") {
                widgets["PaddingComboBox"].setCurrentText("0.1");
            }
            widgets["StrokeWidthLabel"].setText(qsTr("Stroke width (in):"));
            widgets["PaddingWidthLabel"].setText(qsTr("Padding width (in):"));
        } else {
            /* If the defaults are used, update them as well. */
            if (widgets["StrokeComboBox"].currentText === "0.008") {
                widgets["StrokeComboBox"].setCurrentText("0.25");
            }
            if (widgets["PaddingComboBox"].currentText === "0.1") {
                widgets["PaddingComboBox"].setCurrentText("1");
            }
            widgets["StrokeWidthLabel"].setText(qsTr("Stroke width (mm):"));
            widgets["PaddingWidthLabel"].setText(qsTr("Padding width (mm):"));
        }
    });

    var interior = this.initLayerChoiceControl(doc, "InteriorCutsLayerComboBox",  qsTr("interior"));
    var exterior = this.initLayerChoiceControl(doc, "ExteriorCutsLayerComboBox",  qsTr("exterior"));
    var online   = this.initLayerChoiceControl(doc, "OnLineCutsLayerComboBox",    qsTr("on.?line"));
    var pocket   = this.initLayerChoiceControl(doc, "PocketingCutsLayerComboBox", qsTr("pocket"));
    var guide    = this.initLayerChoiceControl(doc, "GuideLayerComboBox",         qsTr("(guide|notes)"));

    var drawingFileName = this.getDocument().getFileName();
    var initialPath = File.getInitialSaveAsPath(drawingFileName, "svg");
    var outputFileInputBox = this.dialog.findChild("OutputFileInput");
    outputFileInputBox.text = initialPath;

    var fileButton = this.dialog.findChild("OutputFileToolButton");
    fileButton.clicked.connect(function(button) {
        var filters = ["svg"];
        EAction.handleUserMessage(qsTr("Button Pressed."));
        var fn = File.getSaveFileName(this, qsTr("Export as Shaper SVG"), outputFileInputBox.text, filters);

        if (isNull(fn)) {
            return undefined;
        }

        var fileName = fn[0] + "." + fn[1];

        if (isNull(fileName) || fileName.length===0) {
            return undefined;
        }

        outputFileInputBox.text = fileName;
    });


    if (!this.dialog.exec()) {
        this.dialog.destroy();
        EAction.activateMainWindow();
        return undefined;
    }

    WidgetFactory.saveState(this.dialog);

    var ret = { 'units': unitCombo.currentData,
                'filename': outputFileInputBox.text,
                'extra': parseFloat(paddingCombo.currentText),
                'stroke': parseFloat(strokeCombo.currentText),
                'interior': "",
                'exterior': "",
                'online': "",
                'pocketing': "",
                'guide': "" };

    if (0 < interior.currentIndex) {
        ret.interior = interior.currentText;
    }
    if (0 < exterior.currentIndex) {
        ret.exterior = exterior.currentText;
    }
    if (0 < online.currentIndex) {
        ret.online = online.currentText;
    }
    if (0 < pocket.currentIndex) {
        ret.pocket = pocket.currentText;
    }
    if (0 < guide.currentIndex) {
        ret.guide = guide.currentText;
    }

    this.dialog.destroy();
    EAction.activateMainWindow();
    return ret;
};

ShaperExport.prototype.exportShaper = function(di, properties) {
    // make sure nothing is selected:
    di.deselectAll();

    var ret = exportShaper(di.getDocument(), properties);

    // restore selection before export:
    if (!isNull(properties["entityids"])) {
        di.selectEntities(properties["entityids"]);
    }

    return ret;
};
