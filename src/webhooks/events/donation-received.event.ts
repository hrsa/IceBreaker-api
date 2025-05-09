export class DonationReceivedEvent {
  constructor(public readonly amount: number, public readonly email?: string, public readonly userId?: string) {
  }
}