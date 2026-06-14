import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

const CONTACT_EMAIL = "zzccbbmm23@gmail.com";
const EFFECTIVE_DATE = "2026년 6월 11일";

export const metadata: Metadata = {
  title: "이용약관 — 마이민턴",
  description: "마이민턴(myminton) 서비스 이용에 관한 약관입니다.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" effectiveDate={EFFECTIVE_DATE}>
      <p>
        본 약관은 마이민턴(myminton, 이하 “서비스”)의 이용 조건과 운영자·이용자의
        권리·의무를 규정합니다. 서비스를 이용함으로써 본 약관에 동의한 것으로 봅니다.
      </p>

      <LegalSection heading="1. 서비스의 내용">
        <p>
          서비스는 배드민턴 동호회의 출석 관리, 코트 배정, 게임 운영, 통계, 대회 모드
          등 동호회 운영 도구를 웹으로 제공합니다. 서비스는 무료로 제공될 수 있으며,
          기능은 사전 고지 후 변경·추가·중단될 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection heading="2. 계정 및 클럽">
        <ul className="list-disc space-y-1 pl-5">
          <li>운영자는 Google 계정으로 로그인하거나, 로그인 없이 일회성으로 이용할 수 있습니다.</li>
          <li>운영 데이터는 클럽(club) 단위로 관리·격리됩니다.</li>
          <li>계정·클럽의 관리 권한 및 데이터에 대한 책임은 해당 운영자에게 있습니다.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. 이용자의 의무">
        <ul className="list-disc space-y-1 pl-5">
          <li>법령 및 본 약관을 준수하고, 타인의 권리를 침해하지 않아야 합니다.</li>
          <li>
            회원 등 제3자의 개인정보를 입력·이용하는 경우, 정보주체에게 고지하고 필요한
            동의를 받아야 합니다.
          </li>
          <li>
            서비스의 정상적인 운영을 방해하는 행위(무단 접근, 과도한 자동화 요청 등)를
            해서는 안 됩니다.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. 데이터의 관리">
        <p>
          운영자가 입력한 회원·운영 데이터의 정확성과 적법성에 대한 책임은 운영자에게
          있습니다. 서비스는 합리적인 수준의 데이터 보관을 위해 노력하나, 천재지변·
          시스템 장애 등 불가피한 사유로 인한 데이터 손실에 대해 책임을 지지 않습니다.
          중요한 데이터는 내보내기 기능 등을 통해 별도로 백업하시기를 권장합니다.
        </p>
      </LegalSection>

      <LegalSection heading="5. 면책 및 책임의 한계">
        <p>
          서비스는 “있는 그대로(as-is)” 제공되며, 특정 목적에의 적합성이나 무중단·무오류
          운영을 보증하지 않습니다. 관련 법령이 허용하는 범위 내에서, 서비스는 이용으로
          인해 발생한 간접·부수적 손해에 대해 책임을 지지 않습니다.
        </p>
      </LegalSection>

      <LegalSection heading="6. 서비스의 중단">
        <p>
          서비스는 운영상·기술상의 필요에 따라 전부 또는 일부를 변경하거나 중단할 수
          있으며, 가능한 경우 사전에 안내합니다.
        </p>
      </LegalSection>

      <LegalSection heading="7. 약관의 변경">
        <p>
          서비스는 필요 시 본 약관을 변경할 수 있으며, 변경된 약관은 본 페이지에 게시한
          시점부터 효력이 발생합니다.
        </p>
      </LegalSection>

      <LegalSection heading="8. 문의처">
        <p>
          약관에 관한 문의는 아래로 연락해 주세요.
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
