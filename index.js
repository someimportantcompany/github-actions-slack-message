const assert = require('http-assert');
const axios = require('axios');
const core = require('@actions/core');
const github = require('@actions/github');

function buildSlackAttachments({ color, state, text }) {
  const { context: { payload, ref, workflow, eventName: event, repo: { owner, repo } } } = github;
}

async function sendToSlack({ botToken, webhookUrl }, args) {
  const { context: { repo: { owner, repo } } } = github;

  let url = 'https://api.slack.com';
  const body = JSON.stringify(args);
  const headers = {
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json',
    'user-agent': `${owner}/${repo} (via @someimportantcompany/github-actions-slack-notify)`,
  };

  if (webhookUrl) {
    url = webhookUrl;
  } else if (typeof botToken === 'string') {
    url = `https://slack.com/api/chat.${args.ts ? 'update' : 'postMessage'}`;
    headers.authorization = botToken.startsWith('Bearer') ? botToken : `Bearer ${botToken}`;
  }

  try {
    const { status, data } = axios.post(url, args, { headers });
    assert(data && data.ok === true, status, new Error(`Error from Slack: ${data ? data.error : 'unknown'}`));
    return data;
  } catch (err) {
    if (err.response && err.response.data && err.response.data.error) {
      const { status, data: { error: code } } = err.response;
      assert(false, status, new Error(`Error from Slack: ${code}`));
    } else {
      throw err;
    }
  }
}

(async () => {
  try {
    const channelID = core.getInput('channel-id');
    const botToken = core.getInput('bot-token');
    const webhookUrl = core.getInput('webhook-url');
    const state = core.getInput('state');
    const text = core.getInput('text');
    const color = core.getInput('color');
    const existingMessageID = core.getInput('message-id');

    assert(channelID, new Error('Expected `channel-id` input'));
    assert(botToken || webhookUrl, new Error('Expected `bot-token` or `webhook-url` input'));
    assert(!existingMessageID || botToken, new Error('Expected `bot-token` since `message-id` input was passed'));
    assert(state || text, new Error('Expected `state` or `text` input'));

    const attachments = buildSlackAttachments({ status, color, github });

    const args = {
      channel: channelID,
      attachments,
      ...(existingMessageID ? { ts: messageId } : {}),
    };

    const { ts: sentMessageID } = await sendToSlack({ botToken, webhookUrl }, args);
    core.setOutput('message_id', sentMessageID);
  } catch (err) {
    core.setFailed(err.message);

    if (process.env.SHOW_STACK_TRACE) {
      throw err;
    }
  }
})();
