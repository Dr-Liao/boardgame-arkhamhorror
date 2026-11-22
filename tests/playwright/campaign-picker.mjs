export async function openCampaignPicker(page, setup) {
  await setup.getByRole('button', { name: '选择战役', exact: true }).click()
  return page.getByRole('dialog', { name: '选择战役', exact: true })
}

export async function selectCampaign(page, setup, campaignId) {
  const picker = await openCampaignPicker(page, setup)
  await picker.getByRole('tab', { name: '第一季', exact: true }).click()
  await picker.locator(`[data-campaign-id="${campaignId}"]`).click()
  await picker.getByRole('button', { name: '确认选择', exact: true }).click()
}
