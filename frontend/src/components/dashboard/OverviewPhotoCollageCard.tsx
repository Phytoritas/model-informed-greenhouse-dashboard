import cucumberGreenhouse from '../../../온실전경3.png';

export default function OverviewPhotoCollageCard() {
  return (
    <div
      className="overflow-hidden rounded-[28px] border border-[rgba(34,34,34,0.06)] bg-white"
      style={{ boxShadow: 'var(--sg-shadow-soft)' }}
    >
      <div className="grid h-[300px] grid-cols-[1.35fr_0.65fr] gap-0 md:h-[340px] xl:h-[312px]">
        <div className="relative min-h-0 overflow-hidden">
          <img
            src={cucumberGreenhouse}
            alt="오이 온실 전경"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,246,0.02),rgba(34,34,34,0.10))]" />
        </div>
        <div className="relative min-h-0 overflow-hidden">
          <img
            src={cucumberGreenhouse}
            alt="오이 온실 전경 상세"
            className="h-full w-full object-cover object-[78%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,246,0.04),rgba(34,34,34,0.16))]" />
        </div>
      </div>
    </div>
  );
}
