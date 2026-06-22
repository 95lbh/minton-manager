import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

const CONTACT_EMAIL = "zzccbbmm23@gmail.com";
const EFFECTIVE_DATE = "2026년 6월 11일";

export const metadata: Metadata = {
  title: "개인정보처리방침 — 마이민턴",
  description: "마이민턴(myminton) 서비스의 개인정보 수집·이용·보관에 관한 안내입니다.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" effectiveDate={EFFECTIVE_DATE}>
      <p>
        마이민턴(myminton, 이하 “서비스”)은 배드민턴 동호회의 출석·코트 배정·게임·통계
        운영을 돕는 웹 서비스입니다. 본 방침은 서비스가 어떤 개인정보를 어떤 목적으로
        수집·이용·보관하는지 안내합니다.
      </p>

      <LegalSection heading="1. 수집하는 개인정보 항목">
        <p>서비스는 다음 정보를 수집합니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>로그인(운영자) 정보</b>: Google 계정으로 로그인 시 제공되는 이메일 주소,
            이름, 프로필 사진. 로그인하지 않는 일회성(비회원) 운영도 지원하며, 이 경우
            익명 식별자만 생성됩니다.
          </li>
          <li>
            <b>운영자가 입력하는 회원 정보</b>: 회원 이름, 성별, 실력 등급, 출생년도,
            전화번호(선택), 출석·게임 참여 기록. 회원(동호회 구성원)은 서비스에
            직접 로그인하지 않으며, 운영자가 관리 목적으로 입력하는 데이터입니다.
          </li>
          <li>
            <b>자동 수집 정보</b>: 서비스 이용 과정에서 접속 로그, 기기·브라우저 정보,
            세션 유지를 위한 쿠키. 방문 통계는 개인을 식별하지 않는 형태(쿠키 미사용)로
            집계됩니다.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. 개인정보의 이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>로그인·계정 식별 및 멀티테넌트(클럽) 데이터 격리</li>
          <li>출석·코트 배정·게임 운영 및 통계 제공</li>
          <li>서비스 운영·유지보수, 오류 대응, 보안 및 부정 이용 방지</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 보유 및 이용 기간">
        <p>
          개인정보는 수집·이용 목적이 달성될 때까지 보관하며, 이용자가 계정 또는
          클럽·회원 데이터를 삭제하면 지체 없이 파기합니다. 다만 관계 법령에서 정한
          경우 해당 기간 동안 보관할 수 있습니다. 회원·통계 데이터의 삭제는 서비스 내
          설정에서 운영자가 직접 수행할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="4. 처리 위탁 및 제3자 제공">
        <p>
          서비스는 원활한 운영을 위해 아래 사업자의 인프라를 이용하며, 이 과정에서
          개인정보가 해당 사업자의 해외 서버에 저장·처리될 수 있습니다. 서비스는
          이용자의 개인정보를 마케팅 목적으로 제3자에게 판매하지 않습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Google</b> — 소셜 로그인(OAuth) 인증, 광고 게재(AdSense, 도입 시)
          </li>
          <li>
            <b>Supabase</b> — 데이터베이스, 인증, 파일(로고) 저장
          </li>
          <li>
            <b>Vercel</b> — 웹 호스팅 및 비식별 방문 통계
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="5. 운영자(이용자)의 책임">
        <p>
          운영자가 회원 등 제3자의 개인정보(이름·성별·출생년도 등)를 입력하는 경우,
          운영자는 해당 정보의 수집·이용에 관하여 정보주체에게 적절히 고지하고 필요한
          동의를 받을 책임이 있습니다. 서비스는 운영자가 입력한 데이터의 적법성에 대해
          보증하지 않습니다.
        </p>
      </LegalSection>

      <LegalSection heading="6. 이용자의 권리">
        <p>
          이용자(및 정보주체)는 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요청할
          수 있습니다. 운영자는 서비스 내 기능을 통해 회원 정보를 직접 수정·삭제할 수
          있으며, 그 밖의 요청은 아래 연락처로 문의해 주세요.
        </p>
      </LegalSection>

      <LegalSection heading="7. 쿠키 및 광고">
        <p>
          서비스는 로그인 세션 유지를 위해 필수 쿠키를 사용합니다. 브라우저 설정에서
          쿠키를 차단할 수 있으나, 이 경우 로그인 등 일부 기능이 제한될 수 있습니다.
        </p>
        <p>
          서비스는 Google AdSense를 통해 광고를 게재할 수 있으며, 이 과정에서 Google
          및 제휴사가 광고 식별 쿠키를 사용할 수 있습니다. 광고 개인 최적화는 Google
          계정 설정(adssettings.google.com)에서 관리할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="8. 개인정보의 안전성 확보">
        <p>
          서비스는 클럽 단위 데이터 격리(Row Level Security), 전송 구간 암호화(HTTPS)
          등을 통해 개인정보를 보호하기 위해 노력합니다.
        </p>
      </LegalSection>

      <LegalSection heading="9. 아동의 개인정보">
        <p>
          서비스는 만 14세 미만 아동을 대상으로 하지 않습니다. 운영자가 아동의 정보를
          입력하는 경우 법정대리인의 동의 등 관련 법령을 준수해야 합니다.
        </p>
      </LegalSection>

      <LegalSection heading="10. 방침의 변경">
        <p>
          본 방침은 법령·서비스 변경에 따라 수정될 수 있으며, 변경 시 본 페이지를 통해
          공지합니다.
        </p>
      </LegalSection>

      <LegalSection heading="11. 문의처">
        <p>
          개인정보 처리에 관한 문의는 아래로 연락해 주세요.
          <br />
          이메일:{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
