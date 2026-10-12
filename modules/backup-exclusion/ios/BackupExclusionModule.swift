import ExpoModulesCore

public class BackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackupExclusion")

    // Marks a directory (and everything in it, now or later) as excluded from
    // iCloud and Finder/iTunes backups. Creates the directory if needed.
    Function("excludeFromBackup") { (path: String) in
      var url = path.hasPrefix("file://")
        ? URL(string: path)!
        : URL(fileURLWithPath: path, isDirectory: true)
      try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    }
  }
}
