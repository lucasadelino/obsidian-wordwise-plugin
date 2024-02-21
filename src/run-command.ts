import { App, type Editor, Notice } from 'obsidian';

import { CommandActions, CommandNames } from './config';
import WordWisePlugin from './main';
import AskForInstructionModal from './modals/ask-for-instruction';
import { getCommands } from './prompts';
import { callTextAPI } from './utils/call-api';
import { log } from './utils/logging';
import { mustacheRender } from './utils/mustache';

export async function runCommand(
	app: App,
	editor: Editor,
	plugin: WordWisePlugin,
	command: CommandNames | string,
) {
	try {
		const input = editor.getSelection();

		if (input.length === 0) {
			new Notice('No input selected');
			return;
		}

		log(plugin, `Running command: ${command}`);

		const actionData = getCommands(plugin.settings).find(
			(p) => p.name === command,
		);

		if (!actionData) {
			throw new Error(`Could not find command data with name ${command}`);
		}

		if (!actionData.data) {
			throw new Error(`Command data with name ${command} has no data`);
		}

		let instructions = '';

		if (actionData.action === CommandActions.CustomInstructions) {
			const modal = new AskForInstructionModal(app);
			modal.open();
			instructions = await modal.promise;
			if (!instructions || instructions === '') return;
		}

		new Notice(
			`Generating text with ${command} (${plugin.settings.aiProvider})...`,
		);

		const userMessage: string = mustacheRender(actionData.data, {
			input,
			instructions,
		});

		const startTime = Date.now(); // Capture start time

		const result = await callTextAPI({
			plugin,
			userMessage,
		});

		if (!result) {
			new Notice(`No result from ${plugin.settings.aiProvider}`);
			return;
		}

		editor.replaceSelection(result);

		const endTime = Date.now(); // Capture end time
		const timeUsed = ((endTime - startTime) / 1000).toFixed(2); // Calculate time used in seconds

		log(
			plugin,
			`Replaced selection with result: ${result} (Time taken: ${timeUsed}s)`,
		);

		new Notice('Text generated.');
	} catch (error) {
		if (error instanceof Error) {
			log(plugin, error);
			new Notice(
				error.message.length > 100
					? 'Error generating text, see console for details'
					: `Error generating text: ${error.message}`,
			);
		}
	}
}
