"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
class Logger {
    constructor() {
        this.logPanel = vscode.window.createOutputChannel('LaTeX Workshop');
        this.compilerLogPanel = vscode.window.createOutputChannel('LaTeX Compiler');
        this.compilerLogPanel.append('Ready');
        this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -10000);
        this.status.command = 'latex-workshop.actions';
        this.status.show();
        this.displayStatus('check', 'statusBar.foreground');
    }
    addLogMessage(message) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        if (configuration.get('message.log.show')) {
            this.logPanel.append(`[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${message}\n`);
        }
    }
    logCommand(message, command, args = []) {
        this.addLogMessage(message + ': ' + command);
        this.addLogMessage(message + ' args: ' + JSON.stringify(args));
    }
    addCompilerMessage(message) {
        this.compilerLogPanel.append(message);
    }
    logError(e) {
        this.addLogMessage(e.message);
        if (e.stack) {
            this.addLogMessage(e.stack);
        }
    }
    logOnRejected(e) {
        if (e instanceof Error) {
            this.logError(e);
        }
        else {
            this.addLogMessage(String(e));
        }
    }
    clearCompilerMessage() {
        this.compilerLogPanel.clear();
    }
    displayStatus(icon, color, message = undefined, severity = 'info', build = '') {
        this.status.text = `$(${icon})${build}`;
        this.status.tooltip = message;
        this.status.color = new vscode.ThemeColor(color);
        if (message === undefined) {
            return;
        }
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        switch (severity) {
            case 'info':
                if (configuration.get('message.information.show')) {
                    void vscode.window.showInformationMessage(message);
                }
                break;
            case 'warning':
                if (configuration.get('message.warning.show')) {
                    void vscode.window.showWarningMessage(message);
                }
                break;
            case 'error':
            default:
                if (configuration.get('message.error.show')) {
                    void vscode.window.showErrorMessage(message);
                }
                break;
        }
    }
    showErrorMessage(message, ...args) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        if (configuration.get('message.error.show')) {
            return vscode.window.showErrorMessage(message, ...args);
        }
        else {
            return undefined;
        }
    }
    showErrorMessageWithCompilerLogButton(message) {
        const res = this.showErrorMessage(message, 'Open compiler log');
        if (res) {
            return res.then(option => {
                switch (option) {
                    case 'Open compiler log': {
                        this.showCompilerLog();
                        break;
                    }
                    default: {
                        break;
                    }
                }
            });
        }
        return;
    }
    showErrorMessageWithExtensionLogButton(message) {
        const res = this.showErrorMessage(message, 'Open LaTeX Workshop log');
        if (res) {
            return res.then(option => {
                switch (option) {
                    case 'Open LaTeX Workshop log': {
                        this.showLog();
                        break;
                    }
                    default: {
                        break;
                    }
                }
            });
        }
        return;
    }
    showLog() {
        this.logPanel.show();
    }
    showCompilerLog() {
        this.compilerLogPanel.show();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map