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
exports.Command = exports.CmdEnvSuggestion = exports.splitSignatureString = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const latex_utensils_1 = require("latex-utensils");
const environment_1 = require("./environment");
const commandfinder_1 = require("./commandlib/commandfinder");
const commandfinder_2 = require("./commandlib/commandfinder");
const surround_1 = require("./commandlib/surround");
function isCmdItemEntry(obj) {
    return (typeof obj.command === 'string') && (typeof obj.snippet === 'string');
}
/**
 * Return {name, args} from a signature string `name` + `args`
 */
function splitSignatureString(signature) {
    const i = signature.search(/[[{]/);
    if (i > -1) {
        return {
            name: signature.substring(0, i),
            args: signature.substring(i, undefined)
        };
    }
    else {
        return {
            name: signature,
            args: ''
        };
    }
}
exports.splitSignatureString = splitSignatureString;
class CmdEnvSuggestion extends vscode.CompletionItem {
    constructor(label, pkg, signature, kind) {
        super(label, kind);
        this.label = label;
        this.package = pkg;
        this.signature = signature;
    }
    /**
     * Return the signature, ie the name + {} for mandatory arguments + [] for optional arguments.
     * The leading backward slash is not part of the signature
     */
    signatureAsString() {
        return this.signature.name + this.signature.args;
    }
    /**
     * Return the name without the arguments
     * The leading backward slash is not part of the signature
     */
    name() {
        return this.signature.name;
    }
    hasOptionalArgs() {
        return this.signature.args.includes('[');
    }
}
exports.CmdEnvSuggestion = CmdEnvSuggestion;
class Command {
    constructor(extension, environment) {
        this.defaultCmds = [];
        this.defaultSymbols = [];
        this.packageCmds = new Map();
        this.extension = extension;
        this.environment = environment;
        this.commandFinder = new commandfinder_1.CommandFinder(extension);
        this.surroundCommand = new surround_1.SurroundCommand();
    }
    initialize(defaultCmds) {
        const snippetReplacements = vscode.workspace.getConfiguration('latex-workshop').get('intellisense.commandsJSON.replace');
        // Initialize default commands and `latex-mathsymbols`
        Object.keys(defaultCmds).forEach(key => {
            if (key in snippetReplacements) {
                const action = snippetReplacements[key];
                if (action === '') {
                    return;
                }
                defaultCmds[key].snippet = action;
            }
            this.defaultCmds.push(this.entryCmdToCompletion(key, defaultCmds[key]));
        });
        // Initialize default env begin-end pairs
        this.environment.getDefaultEnvs(environment_1.EnvSnippetType.AsCommand).forEach(cmd => {
            this.defaultCmds.push(cmd);
        });
    }
    get definedCmds() {
        return this.commandFinder.definedCmds;
    }
    provideFrom(result, args) {
        const suggestions = this.provide(args.document.languageId, args.document, args.position);
        // Commands ending with (, { or [ are not filtered properly by vscode intellisense. So we do it by hand.
        if (result[0].match(/[({[]$/)) {
            const exactSuggestion = suggestions.filter(entry => entry.label === result[0]);
            if (exactSuggestion.length > 0) {
                return exactSuggestion;
            }
        }
        return suggestions;
    }
    provide(languageId, document, position) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        const useOptionalArgsEntries = configuration.get('intellisense.optionalArgsEntries.enabled');
        let range = undefined;
        if (document && position) {
            const startPos = document.lineAt(position).text.lastIndexOf('\\', position.character - 1);
            if (startPos >= 0) {
                range = new vscode.Range(position.line, startPos + 1, position.line, position.character);
            }
        }
        const suggestions = [];
        const cmdDuplicationDetector = new commandfinder_2.CommandSignatureDuplicationDetector();
        // Insert default commands
        this.defaultCmds.forEach(cmd => {
            if (!useOptionalArgsEntries && cmd.hasOptionalArgs()) {
                return;
            }
            cmd.range = range;
            suggestions.push(cmd);
            cmdDuplicationDetector.add(cmd);
        });
        // Insert unimathsymbols
        if (configuration.get('intellisense.unimathsymbols.enabled')) {
            if (this.defaultSymbols.length === 0) {
                const symbols = JSON.parse(fs.readFileSync(`${this.extension.extensionRoot}/data/unimathsymbols.json`).toString());
                Object.keys(symbols).forEach(key => {
                    this.defaultSymbols.push(this.entryCmdToCompletion(key, symbols[key]));
                });
            }
            this.defaultSymbols.forEach(symbol => {
                suggestions.push(symbol);
                cmdDuplicationDetector.add(symbol);
            });
        }
        // Insert commands from packages
        if ((configuration.get('intellisense.package.enabled'))) {
            const extraPackages = this.extension.completer.command.getExtraPkgs(languageId);
            if (extraPackages) {
                extraPackages.forEach(pkg => {
                    this.provideCmdInPkg(pkg, suggestions, cmdDuplicationDetector);
                    this.environment.provideEnvsAsCommandInPkg(pkg, suggestions, cmdDuplicationDetector);
                });
            }
            this.extension.manager.getIncludedTeX().forEach(tex => {
                const pkgs = this.extension.manager.getCachedContent(tex)?.element.package;
                if (pkgs !== undefined) {
                    pkgs.forEach(pkg => {
                        this.provideCmdInPkg(pkg, suggestions, cmdDuplicationDetector);
                        this.environment.provideEnvsAsCommandInPkg(pkg, suggestions, cmdDuplicationDetector);
                    });
                }
            });
        }
        // Start working on commands in tex. To avoid over populating suggestions, we do not include
        // user defined commands, whose name matches a default command or one provided by a package
        const commandNameDuplicationDetector = new commandfinder_2.CommandNameDuplicationDetector(suggestions);
        this.extension.manager.getIncludedTeX().forEach(tex => {
            const cmds = this.extension.manager.getCachedContent(tex)?.element.command;
            if (cmds !== undefined) {
                cmds.forEach(cmd => {
                    if (!commandNameDuplicationDetector.has(cmd)) {
                        cmd.range = range;
                        suggestions.push(cmd);
                        commandNameDuplicationDetector.add(cmd);
                    }
                });
            }
        });
        return suggestions;
    }
    /**
     * Surrounds `content` with a command picked in QuickPick.
     *
     * @param content A string to be surrounded. If not provided, then we loop over all the selections and surround each of them.
     */
    surround() {
        if (!vscode.window.activeTextEditor) {
            return;
        }
        const editor = vscode.window.activeTextEditor;
        const cmdItems = this.provide(editor.document.languageId);
        this.surroundCommand.surround(cmdItems);
    }
    /**
     * Updates the Manager cache for commands used in `file` with `nodes`.
     * If `nodes` is `undefined`, `content` is parsed with regular expressions,
     * and the result is used to update the cache.
     * @param file The path of a LaTeX file.
     * @param nodes AST of a LaTeX file.
     * @param content The content of a LaTeX file.
     */
    update(file, nodes, content) {
        // First, we must update the package list
        this.updatePkg(file, nodes, content);
        // Remove newcommand cmds, because they will be re-insert in the next step
        this.definedCmds.forEach((entry, cmd) => {
            if (entry.file === file) {
                this.definedCmds.delete(cmd);
            }
        });
        const cache = this.extension.manager.getCachedContent(file);
        if (cache === undefined) {
            return;
        }
        if (nodes !== undefined) {
            cache.element.command = this.commandFinder.getCmdFromNodeArray(file, nodes, new commandfinder_2.CommandNameDuplicationDetector());
        }
        else if (content !== undefined) {
            cache.element.command = this.commandFinder.getCmdFromContent(file, content);
        }
    }
    getExtraPkgs(languageId) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        const extraPackages = Array.from(configuration.get('intellisense.package.extra'));
        if (languageId === 'latex-expl3') {
            extraPackages.push('latex-document');
            extraPackages.push('expl3');
        }
        else if (languageId === 'latex') {
            extraPackages.push('latex-document');
        }
        return extraPackages;
    }
    /**
     * Updates the Manager cache for packages used in `file` with `nodes`.
     * If `nodes` is `undefined`, `content` is parsed with regular expressions,
     * and the result is used to update the cache.
     *
     * @param file The path of a LaTeX file.
     * @param nodes AST of a LaTeX file.
     * @param content The content of a LaTeX file.
     */
    updatePkg(file, nodes, content) {
        if (nodes !== undefined) {
            this.updatePkgWithNodeArray(file, nodes);
        }
        else if (content !== undefined) {
            const pkgReg = /\\usepackage(?:\[[^[\]{}]*\])?{(.*)}/g;
            while (true) {
                const result = pkgReg.exec(content);
                if (result === null) {
                    break;
                }
                result[1].split(',').forEach(pkg => {
                    pkg = pkg.trim();
                    if (pkg === '') {
                        return;
                    }
                    const cache = this.extension.manager.getCachedContent(file);
                    if (cache === undefined) {
                        return;
                    }
                    let filePkgs = cache.element.package;
                    if (!filePkgs) {
                        filePkgs = new Set();
                        cache.element.package = filePkgs;
                    }
                    filePkgs.add(pkg);
                });
            }
        }
    }
    updatePkgWithNodeArray(file, nodes) {
        nodes.forEach(node => {
            if (latex_utensils_1.latexParser.isCommand(node) && (node.name === 'usepackage' || node.name === 'documentclass')) {
                node.args.forEach(arg => {
                    if (latex_utensils_1.latexParser.isOptionalArg(arg)) {
                        return;
                    }
                    for (const c of arg.content) {
                        if (!latex_utensils_1.latexParser.isTextString(c)) {
                            continue;
                        }
                        c.content.split(',').forEach(pkg => {
                            pkg = pkg.trim();
                            if (pkg === '') {
                                return;
                            }
                            if (node.name === 'documentclass') {
                                pkg = 'class-' + pkg;
                            }
                            const cache = this.extension.manager.getCachedContent(file);
                            if (cache === undefined) {
                                return;
                            }
                            let pkgs = cache.element.package;
                            if (!pkgs) {
                                pkgs = new Set();
                                cache.element.package = pkgs;
                            }
                            pkgs.add(pkg);
                        });
                    }
                });
            }
            else {
                if (latex_utensils_1.latexParser.hasContentArray(node)) {
                    this.updatePkgWithNodeArray(file, node.content);
                }
            }
        });
    }
    entryCmdToCompletion(itemKey, item) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        const useTabStops = configuration.get('intellisense.useTabStops.enabled');
        const backslash = item.command.startsWith(' ') ? '' : '\\';
        const label = item.label ? `${item.label}` : `${backslash}${item.command}`;
        const suggestion = new CmdEnvSuggestion(label, 'latex', splitSignatureString(itemKey), vscode.CompletionItemKind.Function);
        if (item.snippet) {
            if (useTabStops) {
                item.snippet = item.snippet.replace(/\$\{(\d+):[^$}]*\}/g, '$${$1}');
            }
            // Wrap the selected text when there is a single placeholder
            if (!(item.snippet.match(/\$\{?2/) || (item.snippet.match(/\$\{?0/) && item.snippet.match(/\$\{?1/)))) {
                item.snippet = item.snippet.replace(/\$1|\$\{1\}/, '$${1:$${TM_SELECTED_TEXT}}').replace(/\$\{1:([^$}]+)\}/, '$${1:$${TM_SELECTED_TEXT:$1}}');
            }
            suggestion.insertText = new vscode.SnippetString(item.snippet);
        }
        else {
            suggestion.insertText = item.command;
        }
        suggestion.filterText = itemKey;
        suggestion.detail = item.detail;
        suggestion.documentation = item.documentation ? item.documentation : '`' + item.command + '`';
        suggestion.sortText = item.command.replace(/^[a-zA-Z]/, c => {
            const n = c.match(/[a-z]/) ? c.toUpperCase().charCodeAt(0) : c.toLowerCase().charCodeAt(0);
            return n !== undefined ? n.toString(16) : c;
        });
        if (item.postAction) {
            suggestion.command = { title: 'Post-Action', command: item.postAction };
        }
        else if ((0, commandfinder_1.isTriggerSuggestNeeded)(item.command)) {
            // Automatically trigger completion if the command is for citation, filename, reference or glossary
            suggestion.command = { title: 'Post-Action', command: 'editor.action.triggerSuggest' };
        }
        return suggestion;
    }
    provideCmdInPkg(pkg, suggestions, cmdDuplicationDetector) {
        const configuration = vscode.workspace.getConfiguration('latex-workshop');
        const useOptionalArgsEntries = configuration.get('intellisense.optionalArgsEntries.enabled');
        // Load command in pkg
        if (!this.packageCmds.has(pkg)) {
            const filePath = (0, commandfinder_1.resolveCmdEnvFile)(`${pkg}_cmd.json`, `${this.extension.extensionRoot}/data/packages/`);
            const pkgEntry = [];
            if (filePath !== undefined) {
                try {
                    const cmds = JSON.parse(fs.readFileSync(filePath).toString());
                    Object.keys(cmds).forEach(key => {
                        if (isCmdItemEntry(cmds[key])) {
                            pkgEntry.push(this.entryCmdToCompletion(key, cmds[key]));
                        }
                        else {
                            this.extension.logger.addLogMessage(`Cannot parse intellisense file: ${filePath}`);
                            this.extension.logger.addLogMessage(`Missing field in entry: "${key}": ${JSON.stringify(cmds[key])}`);
                        }
                    });
                }
                catch (e) {
                    this.extension.logger.addLogMessage(`Cannot parse intellisense file: ${filePath}`);
                }
            }
            this.packageCmds.set(pkg, pkgEntry);
        }
        // No package command defined
        const pkgEntry = this.packageCmds.get(pkg);
        if (!pkgEntry || pkgEntry.length === 0) {
            return;
        }
        // Insert commands
        pkgEntry.forEach(cmd => {
            if (!useOptionalArgsEntries && cmd.hasOptionalArgs()) {
                return;
            }
            if (!cmdDuplicationDetector.has(cmd)) {
                suggestions.push(cmd);
                cmdDuplicationDetector.add(cmd);
            }
        });
    }
}
exports.Command = Command;
//# sourceMappingURL=command.js.map