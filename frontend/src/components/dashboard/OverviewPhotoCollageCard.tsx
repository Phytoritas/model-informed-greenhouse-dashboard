import cucumberGreenhousePrimary from '../../../온실전경2.jpg';
import greenhouseDetail from '../../../온실전경3.png';

export default function OverviewPhotoCollageCard() {
  return (
    <div
      className="h-full overflow-hidden rounded-[22px] border border-[rgba(34,34,34,0.06)] bg-white"
      style={{ boxShadow: 'var(--sg-shadow-soft)' }}
    >
      <div className="grid h-full min-h-[172px] grid-cols-[1.35fr_0.65fr] gap-0 md:min-h-[180px] xl:min-h-[188px]">
        <div className="relative min-h-0 overflow-hidden">
          <img
            src={cucumberGreenhousePrimary}
            alt="오이 온실 전경"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,246,0.02),rgba(34,34,34,0.10))]" />
        </div>
        <div className="relative min-h-0 overflow-hidden">
          <img
            src={greenhouseDetail}
            alt="온실 상세 전경"
            className="h-full w-full object-cover object-[78%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,248,246,0.04),rgba(34,34,34,0.16))]" />
        </div>
      </div>
    </div>
  );
}
