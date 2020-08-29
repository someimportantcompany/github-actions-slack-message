/**
 * @author: James D <james@someimportantcompany.com> (https://github.com/someimportantcompany)
 * @license: MIT
 * @link: https://github.com/someimportantcompany/github-actions-slack-notify
 */
const _startCase = require('lodash/startCase');
const assert = require('http-assert');
const axios = require('axios');
const core = require('@actions/core');
const github = require('@actions/github');
const util = require('util');

function buildContextBlock({ payload, ref, workflow, actor, eventName, sha, repo: { owner, repo } }) {
  assert(owner && repo, new Error('Missing owner/repo from context'));
  assert(ref, new Error('Missing git ref from context'));
  assert(sha, new Error('Missing git sha from context'));

  assert(eventName !== 'pull_request' || (payload && payload.pull_request), new Error('Missing pull request payload'));

  const branch = eventName === 'pull_request' ? payload.pull_request.head.ref : ref.replace(/^refs\/heads\//, '');
  sha = eventName === 'pull_request' ? payload.pull_request.head.sha : sha;

  const elements = [];

  if (actor && workflow) {
    elements.push(util.format('*%s* by *<%s|%s>* from *<%s|%s>*', ...[
      eventName ? _startCase(eventName) : 'Trigger',
      `https://github.com/${actor}`, actor,
      `https://github.com/${owner}/${repo}/commit/${sha}/checks`, workflow,
    ]));
  }

  elements.push(util.format('*<%s|%s>* (<%s|%s>) (<%s|#%s>)', ...[
    `https://github.com/${owner}/${repo}`, `${owner}/${repo}`,
    `https://github.com/${owner}/${repo}/tree/${branch}`, `${branch}`,
    `https://github.com/${owner}/${repo}/commit/${sha}`, `${sha.substr(0, 7)}`,
  ]));

  return { type: 'context', elements };
}

async function sendToSlack({ botToken, webhookUrl }, { repo: { owner, repo } }, args) {
  let url = 'https://api.slack.com';
  const headers = {
    'user-agent': `${owner}/${repo} (via @someimportantcompany/github-actions-slack-notify)`,
  };

  if (webhookUrl) {
    url = webhookUrl;
  } else if (typeof botToken === 'string') {
    url = `https://slack.com/api/chat.${args.ts ? 'update' : 'postMessage'}`;
    headers.authorization = botToken.startsWith('Bearer ') ? botToken : `Bearer ${botToken}`;
  }

  try {
    const { status, data } = await axios.post(url, args, { headers });
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

module.exports = async function slackNotify() {
  try {
    const channelID = core.getInput('channel-id');
    const botToken = core.getInput('bot-token');
    const webhookUrl = core.getInput('webhook-url');
    const text = core.getInput('text');
    const color = core.getInput('color');
    const existingMessageID = core.getInput('message-id');

    assert(channelID, new Error('Expected `channel-id` input'));
    assert(text, new Error('Expected `text` input'));
    assert(botToken || webhookUrl, new Error('Expected `bot-token` or `webhook-url` input'));
    assert(!existingMessageID || botToken, new Error('Expected `bot-token` since `message-id` input was passed'));

    const blocks = [
      { type: 'section', text: { type: 'mrkdwn', verbatim: false, text } },
      buildContextBlock(github.context),
    ];

    const args = {
      channel: channelID,
      ...(color ? { attachments: [ { color, blocks } ] } : { blocks }),
      ...(existingMessageID ? { ts: existingMessageID } : {}),
    };

    const { ts: sentMessageID } = await sendToSlack({ botToken, webhookUrl }, github.context, args);
    core.setOutput('message-id', sentMessageID);
  } catch (err) /* istanbul ignore next */ {
    core.setFailed(err.message);

    if (process.env.THROW_ERR) {
      throw err;
    }
  }
};
