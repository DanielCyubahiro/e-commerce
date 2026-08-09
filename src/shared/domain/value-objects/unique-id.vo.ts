export class UniqueId {
  private readonly id: string;

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();
  }

  getValue(): string {
    return this.id;
  }

  equals(other: UniqueId): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this === other) {
      return true;
    }

    if (!(other instanceof UniqueId)) {
      return false;
    }

    return this.id === other.id;
  }
}
