/**
 * @author: jdrydn <james@someimportantcompany.com> (https://github.com/someimportantcompany)
 * @license: MIT
 * @link: https://github.com/someimportantcompany/github-actions-slack-notify
 * @variation: 3c1b552680fe
 */
const axios = require('axios');
const core = require('@actions/core');
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

function assert(value, err) {
  if (Boolean(value) === false) {
    throw err;
  }
}

function buildAttachmentBlock({ color, title, text, imageUrl, thumbUrl }) {
  const {
    GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_WORKFLOW, GITHUB_EVENT_NAME,
    GITHUB_REF, GITHUB_SHA, GITHUB_ACTOR, GITHUB_HEAD_REF,
  } = process.env;
  assert(GITHUB_SERVER_URL, new Error('Missing { GITHUB_SERVER_URL } env'));
  assert(GITHUB_REPOSITORY, new Error('Missing { GITHUB_REPOSITORY } env'));
  assert(GITHUB_REF, new Error('Missing { GITHUB_REF } env'));

  assert(GITHUB_EVENT_NAME !== 'pull_request' || GITHUB_HEAD_REF, new Error('Missing pull request ref'));
  const BRANCH = (GITHUB_EVENT_NAME === 'pull_request' ? GITHUB_HEAD_REF : GITHUB_REF).replace(/^refs\/heads\//, '');

  return {
    ...(color ? { color: COLORS[color] || color } : {}),
    fallback: `[${GITHUB_REPOSITORY}] (${BRANCH}) ${text}`.trim(),
    mrkdwn_in: [ 'text' ],
    ...(GITHUB_WORKFLOW && GITHUB_SHA && GITHUB_RUN_ID ? {
      title: title || `${GITHUB_WORKFLOW} (#${GITHUB_SHA.substr(0, 8)})`,
      title_link: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
    } : {
      title,
    }),
    text,
    ...(GITHUB_ACTOR ? {
      author_name: GITHUB_ACTOR,
      author_link: `${GITHUB_SERVER_URL}/${GITHUB_ACTOR}`,
      author_icon: `${GITHUB_SERVER_URL}/${GITHUB_ACTOR}.png`,
    } : {}),
    ...(imageUrl ? { image_url: imageUrl } : {}),
    ...(thumbUrl ? { thumb_url: thumbUrl } : {}),
    footer: util.format('*<%s|%s>* (<%s|%s>)', ...[
      `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}`, `${GITHUB_REPOSITORY}`,
      `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/tree/${BRANCH}`, BRANCH,
    ]),
    footer_icon: 'https://slack.github.com/static/img/favicon-neutral.png',
  };
}

async function sendToSlack({ botToken, webhookUrl }, body) {
  const { GITHUB_REPOSITORY } = process.env;
  assert(GITHUB_REPOSITORY, new Error('Missing { GITHUB_REPOSITORY } env'));
  assert(webhookUrl || botToken, new Error('Missing botToken/webhookUrl'));
  assert(Object.prototype.toString.call(body) === '[object Object]', new Error('Expected body to be an object'));

  let url = 'https://api.slack.com';
  const headers = {
    'user-agent': `${GITHUB_REPOSITORY} (via someimportantcompany/github-actions-slack-notify)`,
  };

  if (webhookUrl) {
    assert(typeof webhookUrl === 'string', new TypeError('Expected webhookUrl to be a string'));
    url = webhookUrl;
  } else {
    assert(typeof botToken === 'string', new TypeError('Expected botToken to be a string'));
    url = `https://slack.com/api/chat.${body && body.ts ? 'update' : 'postMessage'}`;
    headers.authorization = botToken.startsWith('Bearer ') ? botToken : `Bearer ${botToken}`;
  }

  core.debug('%s %j %j', url, headers, body);

  try {
    const { status, data } = await axios.post(url, body, { headers });
    core.debug(status, data);
    /* istanbul ignore next */
    assert(!botToken || (data && data.ok === true), new Error(`Error from Slack: ${data ? data.error : 'unknown'}`));
    assert(!webhookUrl || data === 'ok', new Error('Error from Slack: Response not OK'));
    return data;
  } catch (err) {
    /* istanbul ignore else */
    if (err.response && err.response.data && err.response.data.error) {
      const { data: { error: code, response_metadata } } = err.response;
      core.debug({ error: code, response_metadata });
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
    const title = core.getInput('title');
    const text = core.getInput('text');
    const color = core.getInput('color');
    const username = core.getInput('username');
    const iconEmoji = core.getInput('icon-emoji');
    const iconUrl = core.getInput('icon-url');
    const existingMessageID = core.getInput('message-id');
    const imageUrl = core.getInput('image-url');
    const thumbUrl = core.getInput('thumb-url');

    core.debug({ botToken, webhookUrl, channel, text, color, existingMessageID });

    assert(botToken || webhookUrl, new Error('Expected `bot-token` or `webhook-url` input'));
    assert(text, new Error('Expected `text` input'));

    assert(!botToken || channel, new Error('Expected `channel` input since `bot-token` was passed'));
    assert(!existingMessageID || botToken, new Error('Expected `bot-token` since `message-id` input was passed'));

    const attachment = buildAttachmentBlock({ color, title, text, imageUrl, thumbUrl });

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
    core.debug(args);

    const { ts: sentMessageID } = await sendToSlack({ botToken, webhookUrl }, args);
    core.debug({ sentMessageID });

    if (botToken) {
      core.setOutput('message-id', sentMessageID);
    }
  } catch (err) /* istanbul ignore next */ {
    core.setFailed(err.message);
    process.env.NODE_ENV !== 'production' && assert(false, err); // eslint-disable-line no-unused-expressions
  }
};

/* istanbul ignore next */
if (!module.parent) {
  module.exports();
}
