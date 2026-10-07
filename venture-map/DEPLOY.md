# 클라우드로 옮기기 (폰·다른 사람과 같이 쓰기)

서버 코드는 이미 클라우드용으로 고쳐져 있습니다. 계정 로그인이 필요한 마지막 단계만 직접 하면 됩니다.

| 환경변수 | 뜻 |
|---|---|
| `APP_PASSWORD` | 설정하면 접속 시 비밀번호 창이 뜹니다. **인터넷에 열 때는 반드시 설정** (아이디는 아무거나) |
| `HOST` | 클라우드에서는 `0.0.0.0` (Dockerfile에 이미 들어 있음) |
| `DATA_DIR` | 저장 폴더. 클라우드 **영구 디스크(볼륨)** 경로로 지정 (Dockerfile 기본 `/data`) |
| `PORT` | 대부분 클라우드가 알아서 넣어 줌 |

처음 실행하면 저장 폴더가 비어 있을 때 템플릿과 예시 프로젝트가 자동으로 복사됩니다.

## Fly.io (추천: 볼륨 포함, 월 몇 달러 이하)
```
cd venture-map
fly launch --copy-config --no-deploy
fly volumes create venture_data --size 1 --region nrt
fly secrets set APP_PASSWORD='원하는비밀번호'
fly deploy
```
끝나면 `https://앱이름.fly.dev` 로 폰에서도 열립니다.

## 주의
- 디스크가 영구 볼륨이 아니면 재시작 때 데이터가 사라집니다. (Render 무료 등은 부적합)
- 기존 `data/projects/*.json` 을 올리려면 볼륨에 복사하세요: `fly ssh sftp shell`
- 이 서버는 한 대에서만 돌리세요(파일 저장 방식).
