# @someimportantcompany/github-actions-slack-notify

[![CICD](https://github.com/someimportantcompany/github-actions-slack-notify/workflows/CICD/badge.svg?branch=master&event=push)](https://github.com/someimportantcompany/github-actions-slack-notify/actions?query=workflow%3ACICD)

Send messages to Slack from GitHub Actions.

This action sends message to Slack during your GitHub Actions workflow. It takes a minimalist approach, showing a handful of metadata options like repository, branch & commit. You can optionally update message in-place to reduce noise in your Slack channel.

## Usage

```yml
- uses: someimportantcompany/github-actions-slack-notify@v1
  with:
    channel: ${{ env.SLACK_CHANNEL }}
    bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    text: All looks good to me!
    color: '#B6B6B6'

- uses: someimportantcompany/github-actions-slack-notify@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    text: Firing a webhook message
```

![Individual messages](./Screenshot%202020-08-29%20at%2019.10.52.png)

- Including a `color` wraps your message in a (soon to be deprecated) `attachments` block.
- Links refer back to your repository, the branch & the commit.

### Updating an existing message

If you are planning to send multiple Slack messages per invocation, and you'd prefer to update a single message instead of posting multiple messages, you can pass the first Slack message's `message-id` to future calls, thus updating in place. **A `bot-token` is required to update messages.**

```yml
- uses: someimportantcompany/github-actions-slack-notify@v1
  id: slack
  with:
    channel: ${{ env.SLACK_CHANNEL }}
    bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    text: Deployment started

- run: npm run deploy

- uses: someimportantcompany/github-actions-slack-notify@v1
  with:
    channel: ${{ env.SLACK_CHANNEL }}
    bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
    text: Deployment finished
    color: good
    message-id: ${{ steps.slack.outputs.message-id }}
```

![Updating message](./Screenshot%202020-08-29%20at%2020.07.02.gif)

### Additional colors

Alongside the Slack default colors `good`, `warning` & `danger`, this action supports some additional colors for convenience:

| Key | Value |
| ---- | ---- |
| `success` | `good` |
| `failed` | `danger` |
| `info` | ![#17a2b8](https://via.placeholder.com/25/17a2b8/000000?text=+) |
| `gray` | ![#B6B6B6](https://via.placeholder.com/25/B6B6B6/000000?text=+) |
| `grey` | ![#B6B6B6](https://via.placeholder.com/25/B6B6B6/000000?text=+) |
| `orange` | ![#FF4500](https://via.placeholder.com/25/FF4500/000000?text=+) |
| `purple` | ![#9400D3](https://via.placeholder.com/25/9400D3/000000?text=+) |

```yml
- uses: someimportantcompany/github-actions-slack-notify@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    text: Build finished
    color: good # Slack already-supported color

- uses: someimportantcompany/github-actions-slack-notify@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    text: Build failed
    color: failed # Aliased color
```
