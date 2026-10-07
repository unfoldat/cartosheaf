# Cloudflare 무료 배포
1. https://dash.cloudflare.com 가입 (카드 불필요)
2. Workers & Pages → Create → Import a repository → `cartosheaf`
   - Root directory: `venture-map-cf`, Branch: `claude/optimistic-hawking-uhyds9`
   - Deploy command 기본값(`npx wrangler deploy`) 그대로
3. 배포 후 Worker → Settings → Variables and Secrets → `APP_PASSWORD` 추가(Secret) → Deploy
4. `https://venture-map.<계정>.workers.dev` 접속 (아이디 아무거나 + 비밀번호)
