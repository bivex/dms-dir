import type { InjectionKey } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DocEntry } from './types'
import { useFavorites } from './useFavorites'
import { useDocForm } from './useDocForm'
import { useDocuments } from './useDocuments'
import { useFolders } from './useFolders'
import { useCalendar } from './useCalendar'
import { useDocViewer } from './useDocViewer'
import { useScanUpload } from './useScanUpload'
import { useEuSign } from './useEuSign'
import { useArchiveExport } from './useArchiveExport'
import { useCounterparties } from './useCounterparties'
import { useDelivery } from './useDelivery'
import { useJournals } from './useJournals'
import { useApprovals } from './useApprovals'
import { useTasks } from './useTasks'
import { onMounted } from 'vue'

/**
 * Склейка всіх composables дашборду в один store + provide/inject-обвʼязка.
 *
 * Спільні примітиви (docs/activeCategory/searchQuery) створюються тут і
 * передаються у composables, щоб уникнути циклічних залежностей
 * (documents ↔ folders ↔ calendar читають однаковий стан).
 */
export function createDashboardStore() {
  const { apiFetch, token } = useAuth()

  const favorites = useFavorites()
  const formStore = useDocForm(apiFetch)

  // спільні примітиви стану
  const docs = ref<DocEntry[]>([])
  const activeCategory = ref<string>('all')
  const searchQuery = ref('')
  function setActiveCategory(c: string) {
    activeCategory.value = c
  }

  const calendar = useCalendar({ docs, searchQuery })

  const folders = useFolders({
    apiFetch,
    docs,
    form: formStore.form,
    activeCategory,
    setActiveCategory
  })

  const documents = useDocuments({
    apiFetch,
    favoritesSet: favorites.favorites,
    removeFromFavorites: favorites.removeFromFavorites,
    folders: folders.folders,
    docs,
    activeCategory,
    searchQuery,
    activeFolderId: folders.activeFolderId,
    selectedDay: calendar.selectedDay,
    docDayKey: calendar.docDayKey,
    selectedDayLabel: calendar.selectedDayLabel,
    formStore,
    reloadFolders: folders.reloadFolders
  })

  const viewer = useDocViewer({ token, form: formStore.form })
  const scan = useScanUpload({
    token,
    refreshAll: documents.refreshAll,
    selectDoc: documents.selectDoc
  })
  const euSign = useEuSign({
    apiFetch,
    token,
    form: formStore.form,
    signerList: formStore.signerList,
    selectDoc: documents.selectDoc,
    refreshAll: documents.refreshAll
  })

  const archiveExport = useArchiveExport()
  const counterparties = useCounterparties({ apiFetch })
  const delivery = useDelivery({ apiFetch, docs })

  const journals = useJournals({ apiFetch })
  const approvals = useApprovals({
    apiFetch,
    refreshAll: () => documents.refreshAll(),
    selectDoc: (docId: string) => documents.selectDoc(docId)
  })
  const tasks = useTasks({ apiFetch })

  onMounted(() => {
    journals.fetchJournals()
  })

  // поточна папка відкритого документа (мітка в заголовку картки)
  const selectedFolderId = computed<number | null>(() => {
    if (!documents.selectedId.value) return null
    return docs.value.find(d => d.doc_id === documents.selectedId.value)?.folder_id ?? null
  })

  // меню «перемістити у папку» для поточного документа
  const moveToFolderItems = computed<DropdownMenuItem[][]>(() => [
    [
      {
        label: 'Без папки',
        icon: 'i-lucide-folder-x',
        onSelect: () => folders.moveDocToFolder(formStore.form.doc_id, null)
      }
    ],
    folders.folders.value.map(f => ({
      label: f.name,
      icon: 'i-lucide-folder',
      color: (f.color && !f.color.startsWith('#'))
        ? (f.color as DropdownMenuItem['color'])
        : undefined,
      onSelect: () => folders.moveDocToFolder(formStore.form.doc_id, f.id)
    }))
  ])

  // відкрити календар: активувати категорію + стрибнути на місяць зі свіжими документами
  function openCalendar() {
    setActiveCategory('calendar')
    calendar.jumpToLatestMonth()
  }

  return {
    // auth
    token,
    // favorites
    favorites: favorites.favorites,
    isFavorite: favorites.isFavorite,
    toggleFavorite: favorites.toggleFavorite,
    loadFavorites: favorites.loadFavorites,
    // form / wizard
    form: formStore.form,
    creatingDoc: formStore.creatingDoc,
    autoRegister: formStore.autoRegister,
    report: formStore.report,
    pdfaInfo: formStore.pdfaInfo,
    docStatus: formStore.docStatus,
    selectedIsScanned: formStore.selectedIsScanned,
    signerList: formStore.signerList,
    approverList: formStore.approverList,
    showFindings: formStore.showFindings,
    showLegalDetails: formStore.showLegalDetails,
    stepperItems: formStore.stepperItems,
    activeStepIndex: formStore.activeStepIndex,
    statusBadge: formStore.statusBadge,
    docFormatLabel: formStore.docFormatLabel,
    signerTimeline: formStore.signerTimeline,
    scrollToStep: formStore.scrollToStep,
    submitDoc: formStore.submitDoc,
    downloadAsice: formStore.downloadAsice,
    generating: formStore.generating,
    submitting: formStore.submitting,
    // documents
    docs,
    selectedId: documents.selectedId,
    activeCategory,
    searchQuery,
    selectMode: documents.selectMode,
    selectedForDelete: documents.selectedForDelete,
    deletingBulk: documents.deletingBulk,
    activeCount: documents.activeCount,
    archivedCount: documents.archivedCount,
    noFolderCount: documents.noFolderCount,
    filteredDocs: documents.filteredDocs,
    listHeaderLabel: documents.listHeaderLabel,
    reloadDocs: documents.reloadDocs,
    refreshAll: documents.refreshAll,
    selectDoc: documents.selectDoc,
    newDocument: documents.newDocument,
    createDoc: documents.createDoc,
    generateDoc: documents.generateDoc,
    downloadDoc: documents.downloadDoc,
    deleteDoc: documents.deleteDoc,
    toggleSelectMode: documents.toggleSelectMode,
    toggleForDelete: documents.toggleForDelete,
    toggleSelectAll: documents.toggleSelectAll,
    deleteSelected: documents.deleteSelected,
    archiveDoc: documents.archiveDoc,
    unarchiveDoc: documents.unarchiveDoc,
    // folders
    folders: folders.folders,
    activeFolderId: folders.activeFolderId,
    activeFolder: documents.activeFolder,
    selectedFolderId,
    moveToFolderItems,
    folderModalOpen: folders.folderModalOpen,
    folderModalMode: folders.folderModalMode,
    folderName: folders.folderName,
    folderColor: folders.folderColor,
    folderSaving: folders.folderSaving,
    FOLDER_COLORS: folders.FOLDER_COLORS,
    folderDotColor: folders.folderDotColor,
    openCreateFolder: folders.openCreateFolder,
    saveFolder: folders.saveFolder,
    selectFolder: folders.selectFolder,
    folderMenuItems: folders.folderMenuItems,
    // calendar
    UA_WEEKDAYS: calendar.UA_WEEKDAYS,
    calMonthLabel: calendar.calMonthLabel,
    calGrid: calendar.calGrid,
    calPrevMonth: calendar.calPrevMonth,
    calNextMonth: calendar.calNextMonth,
    calToday: calendar.calToday,
    pickDay: calendar.pickDay,
    selectedDay: calendar.selectedDay,
    selectedDayLabel: calendar.selectedDayLabel,
    openCalendar,
    // viewer
    viewerOpen: viewer.viewerOpen,
    viewerUrl: viewer.viewerUrl,
    viewerHtml: viewer.viewerHtml,
    viewerMode: viewer.viewerMode,
    viewerLoading: viewer.viewerLoading,
    viewerTitle: viewer.viewerTitle,
    openViewer: viewer.openViewer,
    previewDoc: viewer.previewDoc,
    openViewerInNewTab: viewer.openViewerInNewTab,
    closeViewer: viewer.closeViewer,
    // scan
    scanModalOpen: scan.scanModalOpen,
    scanFile: scan.scanFile,
    scanTitle: scan.scanTitle,
    scanSigners: scan.scanSigners,
    scanUploading: scan.scanUploading,
    openScanModal: scan.openScanModal,
    uploadScan: scan.uploadScan,
    // КЕП
    euReady: euSign.euReady,
    euStatus: euSign.euStatus,
    keySource: euSign.keySource,
    keyPass: euSign.keyPass,
    keyFile: euSign.keyFile,
    caList: euSign.caList,
    caIndex: euSign.caIndex,
    signing: euSign.signing,
    signStep: euSign.signStep,
    signCurrent: euSign.signCurrent,
    initWidget: euSign.initWidget,
    onKeyFile: euSign.onKeyFile,
    bootstrapEuSign: euSign.bootstrap,
    // archive export
    exportModalOpen: archiveExport.exportModalOpen,
    exporting: archiveExport.exporting,
    periodType: archiveExport.periodType,
    startDate: archiveExport.startDate,
    endDate: archiveExport.endDate,
    openExportModal: archiveExport.openExportModal,
    triggerDownload: archiveExport.triggerDownload,
    // counterparties
    counterparties: counterparties.counterparties,
    counterpartiesLoaded: counterparties.counterpartiesLoaded,
    counterpartyModalOpen: counterparties.counterpartyModalOpen,
    counterpartyModalMode: counterparties.counterpartyModalMode,
    counterpartyEditId: counterparties.counterpartyEditId,
    counterpartySaving: counterparties.counterpartySaving,
    counterpartyForm: counterparties.counterpartyForm,
    reloadCounterparties: counterparties.reloadCounterparties,
    openCreateCounterparty: counterparties.openCreateCounterparty,
    openEditCounterparty: counterparties.openEditCounterparty,
    saveCounterparty: counterparties.saveCounterparty,
    deleteCounterparty: counterparties.deleteCounterparty,
    // delivery
    deliveryLoading: delivery.deliveryLoading,
    deliveryExporting: delivery.deliveryExporting,
    deliverySender: delivery.deliverySender,
    deliveryRecipient: delivery.deliveryRecipient,
    deliveryItems: delivery.deliveryItems,
    generateF107: delivery.generateF107,
    generateLabel: delivery.generateLabel,
    fetchDeliveryDetails: delivery.fetchDeliveryDetails,
    addDeliveryItem: delivery.addItem,
    removeDeliveryItem: delivery.removeItem,
    triggerDeliveryExport: delivery.triggerDeliveryExport,
    bulkModalOpen: delivery.bulkModalOpen,
    bulkLoading: delivery.bulkLoading,
    bulkExporting: delivery.bulkExporting,
    bulkSender: delivery.bulkSender,
    bulkRecipient: delivery.bulkRecipient,
    bulkItems: delivery.bulkItems,
    bulkDocIds: delivery.bulkDocIds,
    openBulkDelivery: delivery.openBulkDelivery,
    addBulkItem: delivery.addBulkItem,
    removeBulkItem: delivery.removeBulkItem,
    triggerBulkDeliveryExport: delivery.triggerBulkDeliveryExport,
    // journals
    journals: journals.journals,
    journalsLoading: journals.journalsLoading,
    fetchJournals: journals.fetchJournals,
    createJournal: journals.createJournal,
    // approvals
    approvalSubmitting: approvals.approvalSubmitting,
    approvalActing: approvals.approvalActing,
    myApprovals: approvals.myApprovals,
    approvalsLoading: approvals.approvalsLoading,
    fetchMyApprovals: approvals.fetchMyApprovals,
    submitForApproval: approvals.submitForApproval,
    performApprovalAction: approvals.performApprovalAction,
    downloadApprovalSheet: approvals.downloadApprovalSheet,
    // tasks
    myTasks: tasks.myTasks,
    tasksLoading: tasks.tasksLoading,
    docResolutions: tasks.docResolutions,
    loadingResolutions: tasks.loadingResolutions,
    savingResolution: tasks.savingResolution,
    fetchMyTasks: tasks.fetchMyTasks,
    updateTaskStatus: tasks.updateTaskStatus,
    fetchDocResolutions: tasks.fetchDocResolutions,
    addDocResolution: tasks.addDocResolution
  }
}

export type DashboardStore = ReturnType<typeof createDashboardStore>

export const DASHBOARD_KEY: InjectionKey<DashboardStore> = Symbol('dashboard-store')

/** Inject дашборд-store у дочірніх компонентах. */
export function useDashboard(): DashboardStore {
  const store = inject(DASHBOARD_KEY)
  if (!store) throw new Error('useDashboard() викликано поза контекстом <DashboardStore> (provide)')
  return store
}
