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

function init(basePath) {
    var action = new RGuiAction(qsTr("Shaper Export..."), RMainWindowQt.getMainWindow());
    action.setRequiresDocument(true);
    action.setScriptFile(basePath + "/ShaperExport.js");
    action.setIcon(basePath + "/Shaper.svg");
    action.setDefaultShortcut(new QKeySequence("x,o"));
    action.setDefaultCommands( [ "shaperexport" ]);
    action.setGroupSortOrder(1201);
    action.setSortOrder(100);
    action.setNoState();
    action.setWidgetNames(["FileMenu", "!FileToolBar", "FileToolsPanel", "FileMatrixPanel"]);
}
