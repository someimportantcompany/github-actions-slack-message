/**
 * @author: James D <james@someimportantcompany.com> (https://github.com/someimportantcompany)
 * @license: MIT
 * @link: https://github.com/someimportantcompany/github-actions-slack-notify
 */
const assert = require('http-assert');
const axios = require('axios');
const core = require('@actions/core');
const github = require('@actions/github');
const util = require('util');

const COLORS = {
  'good': 'good',
  'warning': 'warning',
  'danger': 'danger',

  'success': 'good',
  'failure': 'danger',
  'info': '#17a2b8',

  'gray': '#DDDDDD',
  'grey': '#DDDDDD',
  'orange': '#FF4500',
  'purple': '#9400D3',
};

/* istanbul ignore next */ // eslint-disable-next-line no-console
const debug = process.env.SHOW_DEBUG ? console.log : () => null;

function buildAttachmentBlock({ eventName, payload, workflow, actor, repo: { owner, repo }, ref, sha }, { color, text }) {
  assert(owner && repo, new Error('Missing owner/repo from context'));
  assert(ref, new Error('Missing git ref from context'));
  assert(sha, new Error('Missing git sha from context'));

  assert(eventName !== 'pull_request' || (payload && payload.pull_request), new Error('Missing pull request payload'));

  const branch = eventName === 'pull_request' ? payload.pull_request.head.ref : ref.replace(/^refs\/heads\//, '');
  sha = eventName === 'pull_request' ? payload.pull_request.head.sha : sha;

  return {
    ...(color ? { color: COLORS[color] || color } : {}),
    fallback: `[${owner}/${repo}] (${branch}) ${text}`.trim(),
    mrkdwn_in: [ 'text' ],
    ...(workflow ? {
      title: `${workflow} (#${sha.substr(0, 7)})`,
      title_link: `https://github.com/${owner}/${repo}/commit/${sha}/checks`,
    } : {}),
    text,
    ...(actor ? {
      author_name: actor,
      author_link: `https://github.com/${actor}`,
      author_icon: `https://github.com/${actor}.png`,
    } : {}),
    footer: util.format('*<%s|%s>* (<%s|%s>)', ...[
      `https://github.com/${owner}/${repo}`, `${owner}/${repo}`,
      `https://github.com/${owner}/${repo}/tree/${branch}`, branch,
    ]),
    footer_icon: `https://github.com/${owner}.png`,
  };
}

async function sendToSlack({ botToken, webhookUrl }, { repo: { owner, repo } = {} } = {}, body = null) {
  assert(owner && repo, new Error('Missing owner/repo from context'));

  let url = 'https://api.slack.com';
  const headers = {
    'user-agent': `${owner}/${repo} (via someimportantcompany/github-actions-slack-notify)`,
  };

  if (webhookUrl) {
    url = webhookUrl;
  } else if (botToken) {
    assert(typeof botToken === 'string', new TypeError('Expected `botToken` to be a string'));
    url = `https://slack.com/api/chat.${body && body.ts ? 'update' : 'postMessage'}`;
    headers.authorization = botToken.startsWith('Bearer ') ? botToken : `Bearer ${botToken}`;
  } else {
    throw new Error('Missing botToken/webhookUrl');
  }

  debug('%s %s %j', url, headers, body);

  try {
    const { status, data } = await axios.post(url, body, { headers });
    debug('%s %j', status, data);
    assert(!botToken || (data && data.ok === true), new Error(`Error from Slack: ${data ? data.error : 'unknown'}`));
    assert(!webhookUrl || data === 'ok', new Error('Error from Slack: Response not OK'));
    return data;
  } catch (err) {
    /* istanbul ignore else */
    if (err.response && err.response.data && err.response.data.error) {
      const { data: { error: code, response_metadata } } = err.response;
      debug({ error: code, response_metadata });
      assert(false, new Error(`Error from Slack: ${code}`));
    } else {
      throw err;
    }
  }
}

module.exports = async function slackNotify() {
  try {
    const channel = core.getInput('channel');
    const botToken = core.getInput('bot-token');
    const webhookUrl = core.getInput('webhook-url');
    const text = core.getInput('text');
    const color = core.getInput('color');
    const username = core.getInput('username');
    const iconEmoji = core.getInput('icon-emoji');
    const iconUrl = core.getInput('icon-url');
    const existingMessageID = core.getInput('message-id');

    debug('%s', { botToken, webhookUrl, channel, text, color, existingMessageID });

    assert(botToken || webhookUrl, new Error('Expected `bot-token` or `webhook-url` input'));
    assert(text, new Error('Expected `text` input'));

    assert(!botToken || channel, new Error('Expected `channel` input since `bot-token` was passed'));
    assert(!existingMessageID || botToken, new Error('Expected `bot-token` since `message-id` input was passed'));

    const attachment = buildAttachmentBlock(github.context, { color, text });

    const args = {
      ...(channel ? { channel } : {}),
      ...(webhookUrl ? {
        ...(username ? { username } : {}),
        ...(iconEmoji ? { icon_emoji: iconEmoji } : {}),
        ...(iconUrl ? { icon_url: iconUrl } : {}),
      } : {}),
      attachments: [ attachment ],
      ...(existingMessageID ? { ts: existingMessageID } : {}),
    };

    const { ts: sentMessageID } = await sendToSlack({ botToken, webhookUrl }, github.context, args);
    debug('%s', { sentMessageID });

    if (botToken) {
      core.setOutput('message-id', sentMessageID);
    }
  } catch (err) /* istanbul ignore next */ {
    core.setFailed(err.message);

    /* istanbul ignore next */ // eslint-disable-next-line no-console,no-unused-expressions
    process.env.SHOW_DEBUG ? console.error(err) : () => null;

    if (process.env.THROW_ERR) {
      throw err;
    }
  }
};

// eslint-disable-next-line no-unused-expressions
`${process.env.VARIANCE}`;

/* istanbul ignore next */
if (!module.parent) {
  module.exports();
}
