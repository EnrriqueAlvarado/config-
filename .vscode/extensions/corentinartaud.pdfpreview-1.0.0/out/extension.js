"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const open = require("open");
// instance to opening the resource through the native os app
class FileOpener {
    // create new document for given resource
    openCustomDocument(uri) {
        return { uri, dispose: () => { } };
    }
    // resolve the editor by opening file through other app and closing window
    resolveCustomEditor(document, webviewPanel) {
        return __awaiter(this, void 0, void 0, function* () {
            // Close the opened active editor
            vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            // Open the pdf file with native app
            yield open(document.uri.path);
        });
    }
}
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // create the custom editor and push to the array of disposables
    let disposable = vscode.window.registerCustomEditorProvider("pdf.preview", new FileOpener());
    context.subscriptions.push(disposable);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map