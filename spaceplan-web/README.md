# Space Plan — 랜딩 페이지

Next.js 프로젝트야. 이대로 GitHub에 올리고 Vercel에 연결하면 인터넷 주소가 나와.

---

## 인터넷에 올리는 법 (3단계, 약 10분)

### 1. GitHub에 리포 만들기

1. https://github.com/new 접속
2. **Repository name**: `spaceplan` (아무 이름이나 괜찮아)
3. **Public** 또는 **Private** 아무거나 선택
4. 아래 체크박스들은 **전부 비워둬** (README, .gitignore, license 전부 체크 안 함)
5. **Create repository** 클릭

### 2. 이 폴더의 파일들 올리기

방금 만든 리포 화면에 **uploading an existing file** 이라는 파란 링크가 있어. 그걸 클릭.

그다음 이 압축을 푼 폴더 안의 **모든 파일과 폴더를 드래그해서 놓으면 돼.**

> ⚠️ `node_modules` 폴더가 있으면 올리지 마. 용량이 크고 필요 없어.
> (이 압축 파일엔 아예 안 들어 있어.)

올린 뒤 아래 **Commit changes** 클릭.

### 3. Vercel에 연결

1. https://vercel.com/new 접속
2. 방금 만든 GitHub 리포가 목록에 보여 → **Import** 클릭
3. 설정 건드릴 것 없이 **Deploy** 클릭
4. 1~2분 기다리면 **주소가 나와** (`spaceplan-xxxx.vercel.app` 형태)

끝. 이제 그 주소로 아무나 들어올 수 있어.

---

## 앞으로 고칠 때

파일을 고친 뒤 GitHub에 올리기만 하면 Vercel이 **자동으로** 새 버전을 배포해.
따로 배포 버튼 누를 필요 없어.

GitHub 웹사이트에서 파일을 직접 수정해도 되고,
[GitHub Desktop](https://desktop.github.com) 을 쓰면 버튼 하나로 올릴 수 있어.

---

## 폴더 구조

```
app/
  layout.jsx    페이지 껍데기 (제목, 설명)
  page.jsx      첫 화면 — 랜딩을 불러옴
components/
  SpacePlanLanding.jsx   ← 랜딩 전체. 디자인은 전부 여기 있어
package.json    필요한 라이브러리 목록
```

고칠 건 대부분 `components/SpacePlanLanding.jsx` 하나야.

---

## 주의사항

- `SpacePlanLanding.jsx` 안의 `<style>` 블록을 **CSS Module이나 Tailwind로 바꾸지 마.**
  `html,body{height:100%}` 가 전역이어야 "한 화면에 딱 맞음"이 유지돼.
- 카드 호버 효과는 순수 CSS야. `"use client"` 필요 없어.
- 카드 링크는 지금 `/draw-room`, `/marketplace` 를 가리켜.
  아직 그 페이지들이 없어서 눌러도 404가 떠. 마켓플레이스를 옮겨오면 연결돼.

---

## 내 컴퓨터에서 미리 보고 싶으면

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속.
