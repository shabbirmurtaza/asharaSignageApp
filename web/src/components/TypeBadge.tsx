export type SignType =
  | 'prohibition'
  | 'mandatory'
  | 'warning'
  | 'safe_condition'
  | 'direction'
  | 'place'
  | 'notice';

interface Props {
  type: SignType;
}

const LABEL: Record<SignType, string> = {
  prohibition: 'Prohibition',
  mandatory: 'Mandatory',
  warning: 'Warning',
  safe_condition: 'Safe Condition',
  direction: 'Direction',
  place: 'Place',
  notice: 'Notice',
};

export const TypeBadge = ({ type }: Props) => (
  <span className={`badge-type badge-type--${type}`}>
    <span className="badge-type__dot" />
    {LABEL[type]}
  </span>
);
