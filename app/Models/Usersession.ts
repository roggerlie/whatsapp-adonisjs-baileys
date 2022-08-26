import { DateTime } from 'luxon'
import { BaseModel, column } from '@ioc:Adonis/Lucid/Orm'

export default class Usersession extends BaseModel {
  @column({ isPrimary: true })
  public id: number
  
  @column()
  public hp: string
  
  @column()
  public nis: string

  @column()
  public noreg: string

  @column()
  public nama: string

  @column.date({columnName: 'tanggalmasukwa'})
  public tanggalmasukwa: DateTime
 
  @column({columnName: 'active'})
  public active: string

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}
